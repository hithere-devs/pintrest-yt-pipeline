export interface ProcessedVideoEntry {
    url: string;
    filePath: string;
    downloadedAt: string;
}

export type StoredProcessedEntry = ProcessedVideoEntry | string;

export interface QueueState {
    videoLinks: string[];
    videosProcessed: StoredProcessedEntry[];
}
