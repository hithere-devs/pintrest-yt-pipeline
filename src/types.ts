export interface YouTubeUploadData {
    videoId: string;
    uploadedAt: string;
    title: string;
    description: string;
    videoUrl: string;
}

export interface ProcessedVideoEntry {
    url: string;
    filePath: string;
    downloadedAt: string;
    youtube?: YouTubeUploadData;
}

export type StoredProcessedEntry = ProcessedVideoEntry | string;

export interface QueueState {
    videoLinks: string[];
    videosProcessed: StoredProcessedEntry[];
}
