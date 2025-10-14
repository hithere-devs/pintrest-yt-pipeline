import express from 'express';
import type { Request, Response } from 'express';
import cron from 'node-cron';
import { loadQueue } from './dataStore';
import { processNextVideo } from './processor';
import type { ProcessorResult } from './processor';

const app = express();
const PORT = Number.parseInt(process.env.PORT ?? '4000', 10);

interface PendingJobSummary {
    status: 'pending';
    ranAt: null;
}

type JobSummary = (ProcessorResult & { ranAt: string | null; manual?: boolean }) | PendingJobSummary;

let lastJobResult: JobSummary = { status: 'pending', ranAt: null };

async function runJob(): Promise<void> {
    const startedAt = new Date().toISOString();
    try {
        const result = await processNextVideo();
        lastJobResult = { ...result, ranAt: startedAt };

        if (result.status === 'failed') {
            console.error(`Job failed: ${result.error}`);
        } else if (result.status === 'completed') {
            console.log(`Downloaded Pinterest video: ${result.link}`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const failureResult: ProcessorResult = {
            status: 'failed',
            error: message,
        };
        lastJobResult = { ...failureResult, ranAt: startedAt };
        console.error('Unexpected job error', error);
    }
}

cron.schedule('*/2 * * * *', () => {
    void runJob();
});

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', lastJobResult });
});

app.get('/queue', async (_req: Request, res: Response) => {
    const queue = await loadQueue();
    res.json({
        videoLinks: queue.videoLinks,
        videosProcessed: queue.videosProcessed,
        lastJobResult,
    });
});

app.get('/trigger-download', async (_req: Request, res: Response) => {
    const manualResult = await processNextVideo();
    lastJobResult = {
        ...manualResult,
        ranAt: new Date().toISOString(),
        manual: true,
    };
    res.json(lastJobResult);
});

app.listen(PORT, () => {
    console.log(`Pinterest downloader service listening on port ${PORT}`);
    void runJob();
});
