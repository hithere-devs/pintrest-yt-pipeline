import { query, queryOne } from '../pgClient';

// ============= Asset Library Types =============

export type AssetType = 'video' | 'music' | 'voice';

export interface DbAsset {
    id: string;
    type: AssetType;
    name: string;
    description?: string;
    s3Key: string;
    s3Url: string;
    thumbnailUrl?: string;
    duration?: number;
    metadata?: Record<string, any>;
    tags?: string[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateAssetInput {
    type: AssetType;
    name: string;
    description?: string;
    s3Key: string;
    s3Url: string;
    thumbnailUrl?: string;
    duration?: number;
    metadata?: Record<string, any>;
    tags?: string[];
}

// ============= Viral Video Project Types =============

export type ProjectStatus = 'draft' | 'generating_script' | 'generating_voiceover' | 'compositing' | 'completed' | 'failed' | 'scheduled';
export type ScriptType = 'monologue' | 'dialogue' | 'narration';

export interface CaptionSettings {
    font: string;
    fontSize: number;
    fontColor: string;
    strokeColor: string;
    strokeWidth: number;
    position: 'top' | 'center' | 'bottom';
    animation: 'none' | 'fade' | 'slide' | 'bounce';
}

export interface DbViralVideoProject {
    id: string;
    userId: string;
    status: ProjectStatus;
    name?: string;
    backgroundVideoId?: string;
    musicId?: string;
    voiceId?: string;
    voiceName?: string;
    scriptContent?: string;
    scriptType?: ScriptType;
    voiceoverS3Key?: string;
    voiceoverS3Url?: string;
    voiceoverDuration?: number;
    wordTimings?: string;  // JSON string of word timings from TTS
    captionSettings: CaptionSettings;
    finalVideoS3Key?: string;
    finalVideoS3Url?: string;
    finalVideoDuration?: number;
    researchPrompt?: string;
    researchResult?: string;
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}

export interface CreateProjectInput {
    userId: string;
    name?: string;
    backgroundVideoId?: string;
    musicId?: string;
}

// ============= Scheduled Video Types =============

export type ScheduleStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';
export type YoutubePrivacy = 'public' | 'private' | 'unlisted';

export interface DbScheduledVideo {
    id: string;
    projectId: string;
    userId: string;
    scheduledAt: string;
    youtubeTitle?: string;
    youtubeDescription?: string;
    youtubeTags?: string[];
    youtubePrivacy: YoutubePrivacy;
    youtubeVideoId?: string;
    youtubeUrl?: string;
    status: ScheduleStatus;
    errorMessage?: string;
    uploadedAt?: string;
    createdAt: string;
}

// ============= Asset Library Functions =============

export async function createAsset(input: CreateAssetInput): Promise<DbAsset> {
    const result = await queryOne<DbAsset>(
        `INSERT INTO "AssetLibrary" ("type", "name", "description", "s3Key", "s3Url", "thumbnailUrl", "duration", "metadata", "tags")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
            input.type,
            input.name,
            input.description || null,
            input.s3Key,
            input.s3Url,
            input.thumbnailUrl || null,
            input.duration || null,
            JSON.stringify(input.metadata || {}),
            input.tags || null,
        ]
    );
    if (!result) throw new Error('Failed to create asset');
    return result;
}

export async function getAssetsByType(type: AssetType): Promise<DbAsset[]> {
    return query<DbAsset>(
        `SELECT * FROM "AssetLibrary" WHERE "type" = $1 AND "isActive" = true ORDER BY "name" ASC`,
        [type]
    );
}

export async function getAssetById(id: string): Promise<DbAsset | null> {
    return queryOne<DbAsset>(
        `SELECT * FROM "AssetLibrary" WHERE "id" = $1`,
        [id]
    );
}

export async function updateAsset(id: string, updates: Partial<CreateAssetInput & { isActive: boolean }>): Promise<DbAsset | null> {
    const setClauses: string[] = ['"updatedAt" = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
        name: 'name',
        description: 'description',
        s3Key: 's3Key',
        s3Url: 's3Url',
        thumbnailUrl: 'thumbnailUrl',
        duration: 'duration',
        metadata: 'metadata',
        tags: 'tags',
        isActive: 'isActive',
    };

    for (const [key, value] of Object.entries(updates)) {
        if (fieldMap[key] !== undefined && value !== undefined) {
            if (key === 'metadata') {
                setClauses.push(`"${fieldMap[key]}" = $${paramIndex}`);
                values.push(JSON.stringify(value));
            } else {
                setClauses.push(`"${fieldMap[key]}" = $${paramIndex}`);
                values.push(value);
            }
            paramIndex++;
        }
    }

    values.push(id);
    return queryOne<DbAsset>(
        `UPDATE "AssetLibrary" SET ${setClauses.join(', ')} WHERE "id" = $${paramIndex} RETURNING *`,
        values
    );
}

export async function deleteAsset(id: string): Promise<void> {
    await query(`DELETE FROM "AssetLibrary" WHERE "id" = $1`, [id]);
}

export async function searchAssets(type: AssetType, searchTerm?: string, tags?: string[]): Promise<DbAsset[]> {
    let sql = `SELECT * FROM "AssetLibrary" WHERE "type" = $1 AND "isActive" = true`;
    const params: any[] = [type];
    let paramIndex = 2;

    if (searchTerm) {
        sql += ` AND ("name" ILIKE $${paramIndex} OR "description" ILIKE $${paramIndex})`;
        params.push(`%${searchTerm}%`);
        paramIndex++;
    }

    if (tags && tags.length > 0) {
        sql += ` AND "tags" && $${paramIndex}`;
        params.push(tags);
        paramIndex++;
    }

    sql += ` ORDER BY "name" ASC`;
    return query<DbAsset>(sql, params);
}

// ============= Viral Video Project Functions =============

export async function createProject(input: CreateProjectInput): Promise<DbViralVideoProject> {
    const result = await queryOne<DbViralVideoProject>(
        `INSERT INTO "ViralVideoProject" ("userId", "name", "backgroundVideoId", "musicId", "status")
         VALUES ($1, $2, $3, $4, 'draft')
         RETURNING *`,
        [input.userId, input.name || null, input.backgroundVideoId || null, input.musicId || null]
    );
    if (!result) throw new Error('Failed to create project');
    return result;
}

export async function getProjectById(id: string): Promise<DbViralVideoProject | null> {
    return queryOne<DbViralVideoProject>(
        `SELECT * FROM "ViralVideoProject" WHERE "id" = $1`,
        [id]
    );
}

export async function getProjectsByUser(userId: string, status?: ProjectStatus): Promise<DbViralVideoProject[]> {
    if (status) {
        return query<DbViralVideoProject>(
            `SELECT * FROM "ViralVideoProject" WHERE "userId" = $1 AND "status" = $2 ORDER BY "updatedAt" DESC`,
            [userId, status]
        );
    }
    return query<DbViralVideoProject>(
        `SELECT * FROM "ViralVideoProject" WHERE "userId" = $1 ORDER BY "updatedAt" DESC`,
        [userId]
    );
}

export async function updateProject(
    id: string,
    updates: Partial<Omit<DbViralVideoProject, 'id' | 'userId' | 'createdAt'>>
): Promise<DbViralVideoProject | null> {
    const setClauses: string[] = ['"updatedAt" = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
        status: 'status',
        name: 'name',
        backgroundVideoId: 'backgroundVideoId',
        musicId: 'musicId',
        voiceId: 'voiceId',
        voiceName: 'voiceName',
        scriptContent: 'scriptContent',
        scriptType: 'scriptType',
        voiceoverS3Key: 'voiceoverS3Key',
        voiceoverS3Url: 'voiceoverS3Url',
        voiceoverDuration: 'voiceoverDuration',
        captionSettings: 'captionSettings',
        finalVideoS3Key: 'finalVideoS3Key',
        finalVideoS3Url: 'finalVideoS3Url',
        finalVideoDuration: 'finalVideoDuration',
        researchPrompt: 'researchPrompt',
        researchResult: 'researchResult',
        errorMessage: 'errorMessage',
        completedAt: 'completedAt',
    };

    for (const [key, value] of Object.entries(updates)) {
        if (fieldMap[key] !== undefined && value !== undefined) {
            if (key === 'captionSettings') {
                setClauses.push(`"${fieldMap[key]}" = $${paramIndex}`);
                values.push(JSON.stringify(value));
            } else {
                setClauses.push(`"${fieldMap[key]}" = $${paramIndex}`);
                values.push(value);
            }
            paramIndex++;
        }
    }

    if (setClauses.length === 1) return null; // Only updatedAt

    values.push(id);
    return queryOne<DbViralVideoProject>(
        `UPDATE "ViralVideoProject" SET ${setClauses.join(', ')} WHERE "id" = $${paramIndex} RETURNING *`,
        values
    );
}

export async function deleteProject(id: string): Promise<void> {
    await query(`DELETE FROM "ViralVideoProject" WHERE "id" = $1`, [id]);
}

// ============= Scheduled Video Functions =============

export async function createScheduledVideo(input: {
    projectId: string;
    userId: string;
    scheduledAt: Date;
    youtubeTitle?: string;
    youtubeDescription?: string;
    youtubeTags?: string[];
    youtubePrivacy?: YoutubePrivacy;
}): Promise<DbScheduledVideo> {
    const result = await queryOne<DbScheduledVideo>(
        `INSERT INTO "ScheduledVideo" ("projectId", "userId", "scheduledAt", "youtubeTitle", "youtubeDescription", "youtubeTags", "youtubePrivacy")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
            input.projectId,
            input.userId,
            input.scheduledAt.toISOString(),
            input.youtubeTitle || null,
            input.youtubeDescription || null,
            input.youtubeTags || null,
            input.youtubePrivacy || 'private',
        ]
    );
    if (!result) throw new Error('Failed to create scheduled video');
    return result;
}

export async function getScheduledVideosByUser(userId: string): Promise<DbScheduledVideo[]> {
    return query<DbScheduledVideo>(
        `SELECT * FROM "ScheduledVideo" WHERE "userId" = $1 ORDER BY "scheduledAt" ASC`,
        [userId]
    );
}

export async function getPendingScheduledVideos(): Promise<DbScheduledVideo[]> {
    return query<DbScheduledVideo>(
        `SELECT * FROM "ScheduledVideo"
         WHERE "status" = 'pending' AND "scheduledAt" <= NOW()
         ORDER BY "scheduledAt" ASC`,
        []
    );
}

export async function updateScheduledVideo(
    id: string,
    updates: Partial<Omit<DbScheduledVideo, 'id' | 'projectId' | 'userId' | 'createdAt'>>
): Promise<DbScheduledVideo | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
        scheduledAt: 'scheduledAt',
        youtubeTitle: 'youtubeTitle',
        youtubeDescription: 'youtubeDescription',
        youtubeTags: 'youtubeTags',
        youtubePrivacy: 'youtubePrivacy',
        youtubeVideoId: 'youtubeVideoId',
        youtubeUrl: 'youtubeUrl',
        status: 'status',
        errorMessage: 'errorMessage',
        uploadedAt: 'uploadedAt',
    };

    for (const [key, value] of Object.entries(updates)) {
        if (fieldMap[key] !== undefined && value !== undefined) {
            setClauses.push(`"${fieldMap[key]}" = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        }
    }

    if (setClauses.length === 0) return null;

    values.push(id);
    return queryOne<DbScheduledVideo>(
        `UPDATE "ScheduledVideo" SET ${setClauses.join(', ')} WHERE "id" = $${paramIndex} RETURNING *`,
        values
    );
}

export async function deleteScheduledVideo(id: string): Promise<void> {
    await query(`DELETE FROM "ScheduledVideo" WHERE "id" = $1`, [id]);
}

// ============= Aggregate Queries =============

export async function getProjectWithAssets(projectId: string): Promise<{
    project: DbViralVideoProject;
    backgroundVideo?: DbAsset;
    music?: DbAsset;
} | null> {
    const project = await getProjectById(projectId);
    if (!project) return null;

    const backgroundVideo = project.backgroundVideoId
        ? await getAssetById(project.backgroundVideoId)
        : undefined;

    const music = project.musicId
        ? await getAssetById(project.musicId)
        : undefined;

    return {
        project,
        backgroundVideo: backgroundVideo || undefined,
        music: music || undefined,
    };
}

export async function getUserProjectsWithSchedules(userId: string): Promise<Array<DbViralVideoProject & { scheduledVideos: DbScheduledVideo[] }>> {
    const projects = await getProjectsByUser(userId);

    const projectsWithSchedules = await Promise.all(
        projects.map(async (project) => {
            const scheduledVideos = await query<DbScheduledVideo>(
                `SELECT * FROM "ScheduledVideo" WHERE "projectId" = $1 ORDER BY "scheduledAt" ASC`,
                [project.id]
            );
            return { ...project, scheduledVideos };
        })
    );

    return projectsWithSchedules;
}
