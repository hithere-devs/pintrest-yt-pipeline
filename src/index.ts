import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cron from 'node-cron';
import { loadQueue } from './dataStore';
import { processNextVideo } from './processor';
import type { ProcessorResult } from './processor';
import {
    getAuthUrl,
    getTokensFromCode,
    isAuthenticated,
} from './youtubeUploader';

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
            console.log(result);
            console.error(`Job failed: ${result.error}`);
        } else if (result.status === 'completed') {
            console.log(`Downloaded Pinterest video: ${result.link}`);
        }
    } catch (error) {
        console.log(error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        const failureResult: ProcessorResult = {
            status: 'failed',
            error: message,
        };
        lastJobResult = { ...failureResult, ranAt: startedAt };
        console.error('Unexpected job error', error);
    }
}

cron.schedule('* * * * *', () => {
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

// YouTube OAuth2 routes
app.get('/auth/youtube', (_req: Request, res: Response) => {
    try {
        const authUrl = getAuthUrl();
        res.redirect(authUrl);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

app.get('/auth/youtube/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;

    if (!code) {
        return res.status(400).send('Authorization code missing');
    }

    try {
        await getTokensFromCode(code);
        res.send(
            '<h1>YouTube Authorization Successful!</h1><p>You can close this window and return to the application.</p>'
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).send(`<h1>Authorization Failed</h1><p>${message}</p>`);
    }
});

app.get('/auth/youtube/status', (_req: Request, res: Response) => {
    res.json({ authenticated: isAuthenticated() });
});

app.listen(PORT, () => {
    console.log(`Pinterest downloader service listening on port ${PORT}`);
    console.log(`YouTube auth status: ${isAuthenticated() ? 'Authenticated ✓' : 'Not authenticated ✗'}`);
    if (!isAuthenticated()) {
        console.log(`To authenticate with YouTube, visit: http://localhost:${PORT}/auth/youtube`);
    }
    void runJob();
});
