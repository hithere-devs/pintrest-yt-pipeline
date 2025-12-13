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

export interface JobSummary {
    status: 'pending' | 'completed' | 'failed';
    ranAt: string | null;
    manual?: boolean;
    link?: string;
    error?: string;
    filePath?: string;
}

export interface DashboardData extends QueueState {
    lastJobResult: JobSummary;
}
