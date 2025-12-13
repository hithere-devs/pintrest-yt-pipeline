import {
    getNextQueuedVideo,
    updateVideoStatus,
    getLastUploadTime,
    DbVideo
} from './db';
import { downloadPinterestMedia } from './pinterestDL';
import {
    uploadVideo,
    generateMetadata,
} from './youtubeUploader';
import fs from 'fs';
import path from 'path';

type SkippedResult = { status: 'skipped'; reason: string };
type IdleResult = { status: 'idle'; reason: string };
type CompletedResult = {
    status: 'completed';
    link: string;
    resolvedUrl: string;
    videoUrl: string;
    filePath: string;
};
type FailedResult = {
    status: 'failed';
    error: string;
    link?: string;
};

export type ProcessorResult = SkippedResult | IdleResult | CompletedResult | FailedResult;

let isProcessing = false;

// Minimum time gap between uploads in milliseconds (2 hours)
const UPLOAD_RATE_LIMIT_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function processNextVideo(): Promise<ProcessorResult> {
    if (isProcessing) {
        return { status: 'skipped', reason: 'Processor busy with previous job.' };
    }
    isProcessing = true;

    let currentVideo: DbVideo | null = null;

    try {
        currentVideo = await getNextQueuedVideo();

        if (!currentVideo) {
            return { status: 'idle', reason: 'No new video links to process.' };
        }

        console.log(`🎬 Processing video ID ${currentVideo.id}: ${currentVideo.pinterestUrl}`);

        // Check rate limit
        const lastUploadTime = await getLastUploadTime(currentVideo.userId);
        if (lastUploadTime) {
            const now = new Date();
            const timeSinceLastUpload = now.getTime() - lastUploadTime.getTime();
            if (timeSinceLastUpload < UPLOAD_RATE_LIMIT_MS) {
                const waitTimeMs = UPLOAD_RATE_LIMIT_MS - timeSinceLastUpload;
                const waitTimeMinutes = Math.ceil(waitTimeMs / 60000);
                console.log(`⏳ Rate limit: Must wait ${waitTimeMinutes}m since last upload`);

                return {
                    status: 'skipped',
                    reason: `Rate limit exceeded. Wait ${waitTimeMinutes}m`,
                };
            }
        }

        await updateVideoStatus(currentVideo.id, { status: 'PROCESSING' });

        const downloadResult = await downloadPinterestMedia(currentVideo.pinterestUrl);
        const filePath = downloadResult.filePath;
        const pinterestMetadata = downloadResult.metadata;

        await updateVideoStatus(currentVideo.id, {
            status: 'DOWNLOADED',
            localFilePath: filePath,
            downloadedAt: new Date().toISOString(),
            pinterestTitle: pinterestMetadata?.title,
            pinterestDescription: pinterestMetadata?.description
        });

        // Upload to YouTube
        console.log('Uploading to YouTube...');
        const metadata = await generateMetadata(currentVideo.pinterestUrl, pinterestMetadata, filePath);

        // Pass userId to uploadVideo to fetch tokens
        const { videoId, thumbnailUrl } = await uploadVideo(filePath, metadata, currentVideo.userId);

        await updateVideoStatus(currentVideo.id, {
            status: 'UPLOADED',
            youtubeVideoId: videoId,
            youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
            uploadedAt: new Date().toISOString(),
            youtubeTitle: metadata.title,
            youtubeDesc: metadata.description,
            thumbnailUrl: thumbnailUrl
        });

        // Delete local file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return {
            status: 'completed',
            link: currentVideo.pinterestUrl,
            resolvedUrl: currentVideo.pinterestUrl,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
            filePath,
        };

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Job failed: ${message}`);

        if (currentVideo) {
            await updateVideoStatus(currentVideo.id, {
                status: 'FAILED',
                errorMessage: message
            });
        }

        return {
            status: 'failed',
            error: message,
            link: currentVideo?.pinterestUrl,
        };
    } finally {
        isProcessing = false;
    }
}
