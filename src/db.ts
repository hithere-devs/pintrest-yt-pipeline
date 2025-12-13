import { query, queryOne } from './pgClient';
import type { VideoStatus } from './types';
import { randomUUID } from 'crypto';

export interface DbVideo {
    id: string;
    userId: string;
    pinterestUrl: string;
    status: VideoStatus;
    downloadedAt?: string;
    localFilePath?: string;
    youtubeVideoId?: string;
    youtubeUrl?: string;
    uploadedAt?: string;
    youtubeTitle?: string;
    youtubeDesc?: string;
    thumbnailUrl?: string;
    errorMessage?: string;
    pinterestTitle?: string;
    pinterestDescription?: string;
    retryCount?: number;
    lastRetryAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface DbFrame {
    id: string;
    videoId: string;
    index: number;
    timestamp: number;
    s3Url?: string;
    localPath?: string;
    description?: string;
    createdAt?: string;
}

export interface DbResearchTask {
    id: string;
    videoId: string;
    userId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'in_progress';
    title?: string;
    description?: string;
    hashtags?: string[];
    thumbnailPrompt?: string;
    researchInsights?: string;
    theme?: string;
    error?: string;
    startedAt?: string;
    completedAt?: string;
    createdAt?: string;
}

export const MAX_RETRIES = 3;

export async function getNextQueuedVideo(): Promise<DbVideo | null> {
    return queryOne<DbVideo>(
        `SELECT * FROM "Video" WHERE "status" = 'QUEUED' ORDER BY "createdAt" ASC LIMIT 1`
    );
}

export async function getVideoById(userId: string, id: string): Promise<DbVideo | null> {
    return queryOne<DbVideo>(`SELECT * FROM "Video" WHERE "id" = $1 AND "userId" = $2`, [id, userId]);
}

export async function updateVideoStatus(id: string, updates: Partial<DbVideo>) {
    const keys = Object.keys(updates);
    if (keys.length === 0) return;

    const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
    const values = keys.map(k => (updates as any)[k]);

    await query(
        `UPDATE "Video" SET ${setClause}, "updatedAt" = NOW() WHERE "id" = $1`,
        [id, ...values]
    );
}

export async function getUserTokens(userId: string) {
    return queryOne(
        `SELECT "accessToken", "refreshToken", "tokenExpiry" FROM "User" WHERE "id" = $1`,
        [userId]
    );
}

export async function addVideoToQueue(userId: string, url: string) {
    const id = randomUUID();
    const result = await queryOne<DbVideo>(
        `INSERT INTO "Video" ("id", "userId", "pinterestUrl", "status", "updatedAt")
         VALUES ($1, $2, $3, 'QUEUED', NOW())
         RETURNING *`,
        [id, userId, url]
    );
    return result;
}

export async function getLastUploadTime(userId: string): Promise<Date | null> {
    const result = await queryOne<{ uploadedAt: string }>(
        `SELECT "uploadedAt" FROM "Video"
         WHERE "userId" = $1 AND "status" = 'UPLOADED'
         ORDER BY "uploadedAt" DESC LIMIT 1`,
        [userId]
    );
    return result?.uploadedAt ? new Date(result.uploadedAt) : null;
}

export async function saveUserTokens(userId: string, tokens: any, email?: string, youtubeId?: string) {
    const tokenExpiry = new Date(tokens.expiry_date || Date.now() + 3600 * 1000).toISOString();

    await query(
        `INSERT INTO "User" ("id", "email", "accessToken", "refreshToken", "tokenExpiry")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("id") DO UPDATE SET
         "accessToken" = $3, "refreshToken" = $4, "tokenExpiry" = $5,
         "email" = COALESCE($2, "User"."email")`,
        [userId, email || null, tokens.access_token, tokens.refresh_token, tokenExpiry]
    );
}

export async function getUserQueue(userId: string) {
    return query<DbVideo>(
        `SELECT * FROM "Video" WHERE "userId" = $1 AND "status" = 'QUEUED' ORDER BY "createdAt" ASC`,
        [userId]
    );
}

export async function getUserHistory(userId: string, limit = 10) {
    return query<DbVideo>(
        `SELECT * FROM "Video" WHERE "userId" = $1 AND "status" != 'QUEUED'
         ORDER BY "updatedAt" DESC LIMIT $2`,
        [userId, limit]
    );
}

export async function deleteVideo(userId: string, videoId: string) {
    await query(
        `DELETE FROM "Video" WHERE "id" = $1 AND "userId" = $2`,
        [videoId, userId]
    );
}

// Retry-related functions
export async function retryVideo(userId: string, id: string) {
    const result = await queryOne<DbVideo>(
        `UPDATE "Video" SET "status" = 'QUEUED', "retryCount" = COALESCE("retryCount", 0) + 1,
         "lastRetryAt" = NOW(), "errorMessage" = NULL, "updatedAt" = NOW()
         WHERE "id" = $1 AND "userId" = $2
         RETURNING *`,
        [id, userId]
    );
    return result;
}

export async function getNextVideoForRetry(): Promise<DbVideo | null> {
    return queryOne<DbVideo>(
        `SELECT * FROM "Video"
         WHERE "status" = 'FAILED' AND COALESCE("retryCount", 0) < $1
         ORDER BY "lastRetryAt" ASC NULLS FIRST, "createdAt" ASC
         LIMIT 1`,
        [MAX_RETRIES]
    );
}

export async function incrementRetryCount(id: string) {
    await query(
        `UPDATE "Video" SET "retryCount" = COALESCE("retryCount", 0) + 1,
         "lastRetryAt" = NOW(), "updatedAt" = NOW()
         WHERE "id" = $1`,
        [id]
    );
}

export async function resetVideoForRetry(id: string) {
    await query(
        `UPDATE "Video" SET "status" = 'QUEUED', "errorMessage" = NULL, "updatedAt" = NOW()
         WHERE "id" = $1`,
        [id]
    );
}

export async function markVideoPermanentlyFailed(id: string, error: string) {
    await query(
        `UPDATE "Video" SET "status" = 'PERMANENTLY_FAILED', "errorMessage" = $2, "updatedAt" = NOW()
         WHERE "id" = $1`,
        [id, error]
    );
}

// Frame-related functions
export async function saveFrames(videoId: string, frames: Omit<DbFrame, 'id' | 'videoId' | 'createdAt'>[]) {
    const results: DbFrame[] = [];
    for (const frame of frames) {
        const result = await queryOne<DbFrame>(
            `INSERT INTO "Frame" ("videoId", "index", "timestamp", "s3Url", "localPath", "description")
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [videoId, frame.index, frame.timestamp, frame.s3Url, frame.localPath, frame.description]
        );
        if (result) results.push(result);
    }
    return results;
}

export async function getVideoFrames(videoId: string): Promise<DbFrame[]> {
    return query<DbFrame>(
        `SELECT * FROM "Frame" WHERE "videoId" = $1 ORDER BY "index" ASC`,
        [videoId]
    );
}

export async function deleteVideoFrames(videoId: string) {
    await query(`DELETE FROM "Frame" WHERE "videoId" = $1`, [videoId]);
}

// Research task functions
export async function createResearchTask(
    videoId: string,
    userId: string
): Promise<DbResearchTask> {
    const result = await queryOne<DbResearchTask>(
        `INSERT INTO "ResearchTask" ("videoId", "userId", "status", "startedAt")
         VALUES ($1, $2, 'pending', NOW())
         RETURNING *`,
        [videoId, userId]
    );
    if (!result) throw new Error('Failed to create research task');
    return result;
}

export async function updateResearchTask(id: string, updates: Partial<DbResearchTask>) {
    const keys = Object.keys(updates);
    if (keys.length === 0) return;

    const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
    const values = keys.map(k => {
        const val = (updates as any)[k];
        // Handle arrays (like hashtags)
        if (Array.isArray(val)) return val;
        return val;
    });

    await query(
        `UPDATE "ResearchTask" SET ${setClause} WHERE "id" = $1`,
        [id, ...values]
    );
}

export async function getResearchTask(id: string): Promise<DbResearchTask | null> {
    return queryOne<DbResearchTask>(`SELECT * FROM "ResearchTask" WHERE "id" = $1`, [id]);
}

export async function getLatestResearchTask(videoId: string): Promise<DbResearchTask | null> {
    return queryOne<DbResearchTask>(
        `SELECT * FROM "ResearchTask" WHERE "videoId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
        [videoId]
    );
}
