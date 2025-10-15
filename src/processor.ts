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

function getNextUnprocessedLink(queue: QueueState): string | undefined {
    return queue.videoLinks.find((link) => !isLinkProcessed(link, queue.videosProcessed));
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

        if (!nextLink) {
            return { status: 'idle', reason: 'No new video links to process.' };
        }

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

        // Upload to YouTube if authenticated
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
