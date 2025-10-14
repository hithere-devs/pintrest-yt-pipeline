import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { QueueState, ProcessedVideoEntry, StoredProcessedEntry } from './types';

const DATA_PATH = path.resolve('data/data.json');

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
}

function normaliseQueue(partial: Partial<QueueState> | undefined): QueueState {
    const videoLinks = Array.isArray(partial?.videoLinks)
        ? partial.videoLinks.filter((value): value is string => typeof value === 'string')
        : [];

    const videosProcessed = Array.isArray(partial?.videosProcessed)
        ? partial.videosProcessed.filter(
            (entry): entry is StoredProcessedEntry =>
                typeof entry === 'string' ||
                (typeof entry === 'object' && entry !== null && 'url' in entry && 'filePath' in entry && 'downloadedAt' in entry)
        )
        : [];

    return { videoLinks, videosProcessed };
}

async function readJsonFile(): Promise<QueueState> {
    try {
        const raw = await readFile(DATA_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<QueueState>;
        return normaliseQueue(parsed);
    } catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') {
            return { videoLinks: [], videosProcessed: [] };
        }
        throw error;
    }
}

async function writeJsonFile(payload: QueueState): Promise<void> {
    const data = JSON.stringify(payload, null, 2);
    await writeFile(DATA_PATH, `${data}\n`, 'utf-8');
}

export async function loadQueue(): Promise<QueueState> {
    const data = await readJsonFile();
    return normaliseQueue(data);
}

export async function persistQueue(data: QueueState): Promise<void> {
    await writeJsonFile(data);
}

export function markProcessedEntry(link: string, filePath: string): ProcessedVideoEntry {
    return {
        url: link,
        filePath,
        downloadedAt: new Date().toISOString(),
    };
}

export function isLinkProcessed(
    link: string,
    processedEntries: StoredProcessedEntry[],
): boolean {
    return processedEntries.some((entry) => {
        if (typeof entry === 'string') {
            return entry === link;
        }
        if (entry && typeof entry === 'object') {
            return entry.url === link;
        }
        return false;
    });
}
