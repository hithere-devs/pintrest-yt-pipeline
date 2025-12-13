import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { addVideoToQueue, saveUserTokens, getUserQueue, getUserHistory, deleteVideo } from './db';
import { processNextVideo } from './processor';
import type { ProcessorResult } from './processor';
import {
    updateVideoDetails,
    getAuthUrl,
    getTokensFromCode,
} from './youtubeUploader';
import { requireAuth, AuthenticatedRequest } from './authMiddleware';

const app = express();
app.use(cors());
app.use(express.json());
const PORT = Number.parseInt(process.env.PORT ?? '4000', 10);

// Cron Job Management
let cronTask: cron.ScheduledTask;
let currentSchedule = '* * * * *'; // Default: every minute
let isQueuePaused = false;

function startCron(schedule: string) {
    if (cronTask) {
        cronTask.stop();
    }
    currentSchedule = schedule;
    cronTask = cron.schedule(schedule, () => {
        void runJob();
    });
    console.log(`Cron job started with schedule: ${schedule}`);
}

interface PendingJobSummary {
    status: 'pending';
    ranAt: null;
}

type JobSummary = (ProcessorResult & { ranAt: string | null; manual?: boolean }) | PendingJobSummary;

let lastJobResult: JobSummary = { status: 'pending', ranAt: null };

async function runJob(): Promise<void> {
    if (isQueuePaused) {
        console.log('Queue is paused. Skipping job.');
        return;
    }
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

startCron(currentSchedule);

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', lastJobResult });
});

// Protected Routes
app.get('/queue', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    try {
        const queue = await getUserQueue(userId);
        const history = await getUserHistory(userId);

        res.json({
            queue,
            history,
            lastJobResult
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message, errorDetails: error });
    }
});

app.post('/queue/add', requireAuth, async (req: Request, res: Response) => {
    const { url } = req.body;
    const userId = (req as AuthenticatedRequest).user!.id;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Invalid URL' });
    }

    try {
        const video = await addVideoToQueue(userId, url);
        res.json({ success: true, video });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message, errorDetails: error });
    }
});

app.delete('/queue/:videoId', requireAuth, async (req: Request, res: Response) => {
    const { videoId } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;

    try {
        await deleteVideo(userId, videoId);
        res.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message, errorDetails: error });
    }
});

app.get('/trigger-download', requireAuth, async (_req: Request, res: Response) => {
    const manualResult = await processNextVideo();
    lastJobResult = {
        ...manualResult,
        ranAt: new Date().toISOString(),
        manual: true,
    };
    res.json(lastJobResult);
});

// Settings Endpoints
app.get('/settings', requireAuth, (_req: Request, res: Response) => {
    res.json({
        schedule: currentSchedule,
        isQueuePaused
    });
});

app.post('/settings', requireAuth, (req: Request, res: Response) => {
    const { schedule, paused } = req.body;

    if (schedule && cron.validate(schedule)) {
        startCron(schedule);
    }

    if (typeof paused === 'boolean') {
        isQueuePaused = paused;
    }

    res.json({ success: true, schedule: currentSchedule, isQueuePaused });
});

// Video Management
app.put('/videos/:videoId', requireAuth, async (req: Request, res: Response) => {
    const { videoId } = req.params;
    const { title, description, tags } = req.body;
    const userId = (req as AuthenticatedRequest).user!.id;

    try {
        await updateVideoDetails(videoId, { title, description, tags }, userId);
        res.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Google OAuth Routes
app.get('/auth/youtube', (_req: Request, res: Response) => {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
});

app.get('/auth/youtube/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;

    if (!code) {
        return res.status(400).send('Authorization code missing');
    }

    try {
        const tokens = await getTokensFromCode(code);

        // Verify ID token to get user info
        if (!tokens.id_token) {
            throw new Error('No ID token received');
        }

        // We need to verify the ID token to get the user ID (sub)
        // We can import verifyIdToken from youtubeUploader or just decode it if we trust the direct response from Google (which we can for this flow)
        // But better to use the helper we just made
        const { verifyIdToken, getChannelId } = await import('./youtubeUploader');
        const payload = await verifyIdToken(tokens.id_token);

        if (!payload || !payload.sub) {
            throw new Error('Invalid ID token');
        }

        const userId = payload.sub;
        const email = payload.email;

        if (!email) {
            throw new Error('Email not found in ID token');
        }

        // Get YouTube Channel ID
        const youtubeId = await getChannelId(tokens);

        // Save tokens to DB
        await saveUserTokens(userId, tokens, email, youtubeId);

        // Redirect to frontend with ID token
        // In production, use a secure cookie or a separate frontend URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
        res.redirect(`${frontendUrl}/?token=${tokens.id_token}&userId=${userId}&email=${email}`);

    } catch (error: any) {
        const message = error instanceof Error ? error.message : (JSON.stringify(error) || 'Unknown error');
        console.error('Auth Error:', error);
        res.status(500).send(`Authentication failed: ${message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
