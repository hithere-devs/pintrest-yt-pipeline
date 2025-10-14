import {
    loadQueue,
    persistQueue,
    markProcessedEntry,
    isLinkProcessed,
} from './dataStore';
import { resolvePinUrl, extractVideoUrl } from './pinterestClient';
import { downloadVideo } from './downloader';
import type { QueueState } from './types';

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

        const resolvedUrl = await resolvePinUrl(nextLink);
        const videoUrl = await extractVideoUrl(resolvedUrl);
        const filePath = await downloadVideo(videoUrl);

        queue.videosProcessed.push(markProcessedEntry(nextLink, filePath));
        await persistQueue(queue);

        return {
            status: 'completed',
            link: nextLink,
            resolvedUrl,
            videoUrl,
            filePath,
        };
    } catch (error) {
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
