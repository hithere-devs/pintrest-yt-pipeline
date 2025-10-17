import {
    loadQueue,
    persistQueue,
    markProcessedEntry,
    isLinkProcessed,
} from './dataStore';
import { downloadPinterestMedia } from './pinterestDL';
import {
    uploadVideo,
    generateMetadata,
    isAuthenticated,
} from './youtubeUploader';
import type { QueueState, ProcessedVideoEntry } from './types';
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

function getNextUnprocessedLink(queue: QueueState): string | undefined {
    return queue.videoLinks.find((link) => !isLinkProcessed(link, queue.videosProcessed));
}

/**
 * Check if enough time has passed since the last YouTube upload
 * Returns true if we can proceed with upload, false if we need to wait
 */
function canUploadNow(queue: QueueState): { canUpload: boolean; reason?: string; waitTimeMs?: number } {
    // Find the most recent YouTube upload
    let latestUploadTime: Date | null = null;

    for (const entry of queue.videosProcessed) {
        if (typeof entry !== 'string' && entry.youtube?.uploadedAt) {
            const uploadTime = new Date(entry.youtube.uploadedAt);
            if (!latestUploadTime || uploadTime > latestUploadTime) {
                latestUploadTime = uploadTime;
            }
        }
    }

    // If no previous uploads, allow upload
    if (!latestUploadTime) {
        return { canUpload: true };
    }

    // Calculate time since last upload
    const now = new Date();
    const timeSinceLastUpload = now.getTime() - latestUploadTime.getTime();

    // Check if 2 hours have passed
    if (timeSinceLastUpload >= UPLOAD_RATE_LIMIT_MS) {
        return { canUpload: true };
    }

    // Calculate remaining wait time
    const waitTimeMs = UPLOAD_RATE_LIMIT_MS - timeSinceLastUpload;
    const waitTimeMinutes = Math.ceil(waitTimeMs / 60000);
    const waitTimeHours = Math.floor(waitTimeMinutes / 60);
    const remainingMinutes = waitTimeMinutes % 60;

    let timeString = '';
    if (waitTimeHours > 0) {
        timeString = `${waitTimeHours}h ${remainingMinutes}m`;
    } else {
        timeString = `${waitTimeMinutes}m`;
    }

    return {
        canUpload: false,
        reason: `Rate limit: Must wait ${timeString} since last upload (${latestUploadTime.toISOString()})`,
        waitTimeMs,
    };
}

export async function processNextVideo(): Promise<ProcessorResult> {
    if (isProcessing) {
        return { status: 'skipped', reason: 'Processor busy with previous job.' };
    }
    isProcessing = true;

    let nextLink: string | undefined;

    try {
        const queue = await loadQueue();
        nextLink = getNextUnprocessedLink(queue);

        // Calculate and log queue statistics
        const totalLinks = queue.videoLinks.length;
        const processedCount = queue.videosProcessed.length;
        const remainingCount = totalLinks - processedCount;

        console.log(`📊 Queue Status: ${processedCount} processed | ${remainingCount} remaining | ${totalLinks} total`);

        if (!nextLink) {
            return { status: 'idle', reason: 'No new video links to process.' };
        }

        // Check rate limit BEFORE downloading to save disk space
        if (isAuthenticated()) {
            const rateLimitCheck = canUploadNow(queue);

            if (!rateLimitCheck.canUpload) {
                console.log(`⏳ ${rateLimitCheck.reason}`);
                console.log(`⏭️  Skipping download to save disk space`);
                console.log(`⏰ Next upload available in: ${Math.ceil((rateLimitCheck.waitTimeMs || 0) / 60000)} minutes`);

                // Don't download yet - will retry later when rate limit allows
                return {
                    status: 'skipped',
                    reason: rateLimitCheck.reason || 'Rate limit exceeded',
                };
            }
        }

        console.log(`🎬 Processing video ${processedCount + 1}/${totalLinks}: ${nextLink}`);

        const downloadResult = await downloadPinterestMedia(nextLink);
        const filePath = downloadResult.filePath;
        const pinterestMetadata = downloadResult.metadata;

        // Log extracted Pinterest metadata
        if (pinterestMetadata?.title) {
            console.log(`📌 Pinterest title: ${pinterestMetadata.title}`);
        }
        if (pinterestMetadata?.description) {
            console.log(`📌 Pinterest description: ${pinterestMetadata.description.substring(0, 100)}...`);
        }

        // Create processed entry
        const processedEntry: ProcessedVideoEntry = markProcessedEntry(nextLink, filePath);

        // Upload to YouTube (rate limit already checked)
        if (isAuthenticated()) {

            try {
                console.log('Uploading to YouTube...');
                console.log('Generating AI-powered metadata...');
                const metadata = await generateMetadata(nextLink, pinterestMetadata, filePath);
                const videoId = await uploadVideo(filePath, metadata);

                // Add YouTube data to processed entry
                processedEntry.youtube = {
                    videoId,
                    uploadedAt: new Date().toISOString(),
                    title: metadata.title,
                    description: metadata.description,
                    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
                };

                console.log(`YouTube upload complete: ${processedEntry.youtube.videoUrl}`);

                // Delete the video file after successful upload
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`🗑️  Deleted local file: ${path.basename(filePath)}`);
                    }
                } catch (deleteError) {
                    const deleteMessage = deleteError instanceof Error ? deleteError.message : 'Unknown error';
                    console.warn(`Failed to delete local file: ${deleteMessage}`);
                    // Don't fail the whole process if file deletion fails
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error(`YouTube upload failed: ${message}`);
                // Continue anyway - we still have the downloaded file
            }
        } else {
            console.log('YouTube upload skipped (not authenticated)');
        }

        queue.videosProcessed.push(processedEntry);
        await persistQueue(queue);

        console.log(`✅ Completed! Progress: ${processedCount + 1}/${totalLinks} videos processed`);

        return {
            status: 'completed',
            link: nextLink,
            resolvedUrl: nextLink,
            videoUrl: nextLink,
            filePath,
        };
    } catch (error) {
        console.error(error)
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
            status: 'failed',
            error: message,
            link: nextLink,
        };
    } finally {
        isProcessing = false;
    }
}
