import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import {
    addVideoToQueue,
    saveUserTokens,
    getUserQueue,
    getUserHistory,
    deleteVideo,
    getVideoById,
    updateVideoStatus,
    saveFrames,
    getVideoFrames,
    deleteVideoFrames,
    createResearchTask,
    updateResearchTask,
    getResearchTask,
    getLatestResearchTask,
    type DbFrame,
    type DbResearchTask
} from './db';
import { initializeDatabase } from './pgClient';
import { processNextVideo } from './processor';
import type { ProcessorResult } from './processor';
import {
    updateVideoDetails,
    getAuthUrl,
    getTokensFromCode,
} from './youtubeUploader';
import { requireAuth, AuthenticatedRequest } from './authMiddleware';
import { extractFrames, analyzeFrames, cleanupFrames, type ExtractedFrame } from './videoFrameAnalyzer';
import { downloadPinterestMedia } from './pinterestDL';
import { DeepResearch, type DeepResearchResult } from './deepResearch';
import { uploadFrames, isS3Configured, deleteFramesFromS3 } from './s3Client';

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

// Auth Verification Endpoint - validates JWT and returns user info
app.get('/auth/verify', requireAuth, async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user!;
    res.json({
        valid: true,
        user: {
            id: user.id,
            email: user.email
        }
    });
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

app.post('/queue/:videoId/retry', requireAuth, async (req: Request, res: Response) => {
    const { videoId } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;

    try {
        const { retryVideo } = await import('./db');
        const updated = await retryVideo(userId, videoId);
        if (!updated) {
            return res.status(404).json({ error: 'Video not found or cannot be retried' });
        }
        res.json({ success: true, message: 'Video queued for retry' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message, errorDetails: error });
    }
});

// Get single video by ID
app.get('/videos/:videoId', requireAuth, async (req: Request, res: Response) => {
    const { videoId } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;

    try {
        const video = await getVideoById(userId, videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }
        res.json(video);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
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

// Frame Extraction Routes
const extractedFramesCache = new Map<string, ExtractedFrame[]>();

// Serve static frame files
app.use('/frames/static', express.static(path.join(process.cwd(), 'frames')));

// Extract frames from a video and save to S3/DB
app.post('/frames/extract', requireAuth, async (req: Request, res: Response) => {
    const { videoId, frameCount = 5, quality = 80, analyze = false } = req.body;
    const userId = (req as AuthenticatedRequest).user!.id;

    if (!videoId) {
        return res.status(400).json({ error: 'videoId is required' });
    }

    // Validate frameCount
    const validFrameCounts = [5, 10, 15, 20, 25, 30];
    if (!validFrameCounts.includes(frameCount)) {
        return res.status(400).json({
            error: `Invalid frameCount. Must be one of: ${validFrameCounts.join(', ')}`
        });
    }

    try {
        // Get video from DB to find local file path
        const video = await getVideoById(userId, videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        let absolutePath: string;

        if (video.localFilePath) {
            // Check if file exists
            absolutePath = path.isAbsolute(video.localFilePath)
                ? video.localFilePath
                : path.join(process.cwd(), video.localFilePath);
        } else {
            absolutePath = '';
        }

        // Re-download if file doesn't exist on disk
        if (!absolutePath || !fs.existsSync(absolutePath)) {
            console.log(`📥 Video file not found on disk, re-downloading from Pinterest...`);

            if (!video.pinterestUrl) {
                return res.status(400).json({ error: 'No Pinterest URL available to re-download' });
            }

            try {
                const { filePath: newFilePath } = await downloadPinterestMedia(video.pinterestUrl);
                absolutePath = path.isAbsolute(newFilePath)
                    ? newFilePath
                    : path.join(process.cwd(), newFilePath);

                // Update the video record with new file path
                await updateVideoStatus(video.id, {
                    localFilePath: newFilePath,
                    downloadedAt: new Date().toISOString()
                });

                console.log(`✅ Video re-downloaded to: ${absolutePath}`);
            } catch (downloadError) {
                const message = downloadError instanceof Error ? downloadError.message : 'Unknown download error';
                console.error('Failed to re-download video:', message);
                return res.status(500).json({ error: `Failed to re-download video: ${message}` });
            }
        }

        // Delete existing frames for this video
        await deleteVideoFrames(videoId);

        // Extract frames
        console.log(`📸 Extracting ${frameCount} frames from video ${videoId}...`);
        let frames = await extractFrames(absolutePath, {
            frameCount,
            quality,
            outputDir: path.join(process.cwd(), 'frames', videoId)
        });

        // Optionally analyze frames with AI
        if (analyze) {
            console.log('🔍 Analyzing frames with AI...');
            frames = await analyzeFrames(frames);
        }

        // Upload to S3 if configured, otherwise use local URLs
        let frameDataForDb: Array<{
            index: number;
            timestamp: number;
            s3Url?: string;
            localPath?: string;
            description?: string;
        }> = [];

        if (isS3Configured()) {
            console.log('☁️ Uploading frames to S3...');
            const s3Results = await uploadFrames(videoId, frames.map(f => ({
                filePath: f.filePath,
                index: f.index,
                timestamp: f.timestamp
            })));

            frameDataForDb = s3Results.map((s3Frame, idx) => ({
                index: s3Frame.index,
                timestamp: s3Frame.timestamp,
                s3Url: s3Frame.s3Url,
                localPath: frames[idx].filePath,
                description: frames[idx].description
            }));
        } else {
            // Use local file paths
            frameDataForDb = frames.map(f => ({
                index: f.index,
                timestamp: f.timestamp,
                localPath: f.filePath,
                description: f.description
            }));
        }

        // Save frames to database
        console.log('💾 Saving frames to database...');
        const savedFrames = await saveFrames(videoId, frameDataForDb);

        // Cache the frames for cleanup later
        extractedFramesCache.set(videoId, frames);

        // Return frame data with URLs
        const frameData = savedFrames.map(f => ({
            id: f.id,
            index: f.index,
            timestamp: Number(f.timestamp),
            url: f.s3Url || `/frames/static/${videoId}/${path.basename(f.localPath || '')}`,
            description: f.description || null
        }));

        res.json({
            success: true,
            videoId,
            frameCount: savedFrames.length,
            frames: frameData,
            s3Enabled: isS3Configured()
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Frame extraction error:', error);
        res.status(500).json({ error: message });
    }
});

// Clean up extracted frames for a video
app.delete('/frames/:videoId', requireAuth, async (req: Request, res: Response) => {
    const { videoId } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;

    try {
        // Verify video belongs to user
        const video = await getVideoById(userId, videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Delete from database
        await deleteVideoFrames(videoId);

        // Get cached frames or look for frame directory
        const cachedFrames = extractedFramesCache.get(videoId);
        if (cachedFrames) {
            await cleanupFrames(cachedFrames);
            extractedFramesCache.delete(videoId);
        } else {
            // Try to delete the frame directory directly
            const frameDir = path.join(process.cwd(), 'frames', videoId);
            if (fs.existsSync(frameDir)) {
                fs.rmSync(frameDir, { recursive: true, force: true });
            }
        }

        res.json({ success: true, message: 'Frames cleaned up' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Get frames for a video from database
app.get('/frames/:videoId', requireAuth, async (req: Request, res: Response) => {
    const { videoId } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;

    try {
        // Verify video belongs to user
        const video = await getVideoById(userId, videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const frames = await getVideoFrames(videoId);

        const frameData = frames.map(f => ({
            id: f.id,
            index: f.index,
            timestamp: Number(f.timestamp),
            s3Url: f.s3Url || null,
            localPath: f.localPath || null,
            url: f.s3Url || `/frames/static/${videoId}/${path.basename(f.localPath || '')}`,
            description: f.description || null
        }));

        res.json({
            success: true,
            videoId,
            frameCount: frames.length,
            frames: frameData
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Get available frame count options
app.get('/frames/options', requireAuth, (_req: Request, res: Response) => {
    res.json({
        frameCountOptions: [5, 10, 15, 20, 25, 30],
        defaultFrameCount: 5,
        qualityRange: { min: 50, max: 100, default: 80 }
    });
});

// Deep Research Routes - Now using database for persistence

// Start deep research for a video
app.post('/research/video', requireAuth, async (req: Request, res: Response) => {
    const { videoId } = req.body;
    const userId = (req as AuthenticatedRequest).user!.id;

    if (!videoId) {
        return res.status(400).json({ error: 'videoId is required' });
    }

    try {
        // Get video details from DB
        const video = await getVideoById(userId, videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Get frames from database
        const dbFrames = await getVideoFrames(videoId);

        // Create task in database
        const task = await createResearchTask(videoId, userId);
        const taskId = task.id;

        // Return immediately with task ID
        res.json({
            success: true,
            taskId,
            message: 'Deep research started'
        });

        // Run research in background
        (async () => {
            try {
                await updateResearchTask(taskId, { status: 'in_progress' });

                const deepResearch = new DeepResearch();

                // Extract frame descriptions from database frames
                const frameDescriptions = dbFrames
                    .filter(f => f.description)
                    .map(f => f.description as string);

                // Build research context
                const context = `You are a content research specialist for the brand "@faithandfork".
The brand creates two types of content:
1. Halal food and recipes - mouth-watering dishes, cooking tips, and recipe inspiration
2. Spiritually uplifting Islamic content - peaceful, inspirational content for Muslim families

Available information about this video:
- Source URL: ${video.pinterestUrl || 'Unknown'}
- Original title: ${video.pinterestTitle || 'Not available'}
- Original description: ${video.pinterestDescription || 'Not available'}
${frameDescriptions.length > 0 ? `\nVideo frame descriptions:\n${frameDescriptions.map((d: string, i: number) => `  Frame ${i + 1}: ${d}`).join('\n')}` : ''}`;

                const query = `Based on the video information provided, perform comprehensive research to create viral YouTube content:

1. **Identify the theme**: Is this Faith/Spiritual content or Food/Recipe content?

2. **Generate an optimized YouTube title** (max 80 characters):
   - Make it engaging, emotional, and click-worthy
   - Use Hinglish/Urdu words if culturally appropriate (e.g., "Subhanallah", "Mashallah", "Delicious Biryani")
   - Should evoke curiosity or emotion
   - Do NOT include hashtags in the title

3. **Generate an SEO-optimized description** (200-400 words):
   - Start with a powerful hook that matches the video theme
   - Include relevant keywords naturally throughout
   - Add a compelling call-to-action (subscribe, like, share)
   - Include social links placeholders
   - Make it personal and relatable

4. **Generate exactly 3 top-performing hashtags**:
   - These should be the BEST 3 hashtags that will maximize reach
   - Mix of popular and niche hashtags
   - Format: lowercase with # prefix

5. **Create a thumbnail generation prompt** (detailed):
   - Describe the ideal thumbnail that would maximize click-through rate
   - Include visual elements, colors, text overlay suggestions
   - Reference the video frames for context
   - Should be detailed enough for an AI image generator

6. **Provide research insights** (brief):
   - Why this content will perform well
   - Target audience insights
   - Best posting time suggestions

Please structure your response clearly with sections for Title, Description, Hashtags, Thumbnail Prompt, and Insights.`;

                const result = await deepResearch.research(query, {
                    context,
                    timeout: 10 * 60 * 1000, // 10 minutes
                    metadata: { type: 'video_content', videoId },
                    onStatusUpdate: (status, progress) => {
                        console.log(`📊 Research ${taskId}: ${status} - ${progress}`);
                    }
                });

                if (result.status === 'failed' || !result.result) {
                    throw new Error(result.error || 'Research failed to produce results');
                }

                // Store the raw research result - we'll parse it on the frontend or later
                const rawResult = result.result;

                // Try to extract structured data, but don't fail if we can't
                let title = '';
                let description = '';
                let hashtags: string[] = [];
                let thumbnailPrompt = '';
                let researchInsights = '';
                let theme = 'other';

                // Try JSON parsing first
                const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        const parsed = JSON.parse(jsonMatch[0]);
                        title = parsed.title || '';
                        description = parsed.description || '';
                        hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 3) : [];
                        thumbnailPrompt = parsed.thumbnailPrompt || '';
                        researchInsights = parsed.researchInsights || '';
                        theme = parsed.theme || 'other';
                    } catch {
                        // JSON parsing failed, use raw result
                        console.log('JSON parsing failed, storing raw result');
                    }
                }

                // If we couldn't parse JSON, store the raw result in researchInsights
                // and trigger LLM extraction
                if (!title && !description) {
                    researchInsights = rawResult;

                    // Auto-extract structured data using LLM
                    console.log(`🤖 Auto-extracting structured data for task ${taskId}...`);
                    try {
                        const apiKey = process.env.GEMINI_API_KEY;
                        if (apiKey) {
                            const { GoogleGenerativeAI } = await import('@google/generative-ai');
                            const genAI = new GoogleGenerativeAI(apiKey);
                            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                            const extractionPrompt = `You are a YouTube content expert. Extract structured metadata from this research content for a YouTube video.

The brand is "@faithandfork" which creates:
1. Halal food and recipes content
2. Spiritually uplifting Islamic content

RESEARCH CONTENT:
${rawResult}

Extract and return a JSON object with these exact fields:
{
  "theme": "faith" or "food" (based on content type),
  "title": "An engaging YouTube title (max 80 chars, can use Hinglish/Urdu words like Subhanallah, Mashallah if appropriate)",
  "description": "A compelling YouTube description (200-400 words with hooks, keywords, call-to-action)",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"] (exactly 3 best performing hashtags),
  "thumbnailPrompt": "A detailed prompt for AI image generation describing the ideal thumbnail with colors, elements, text overlay suggestions"
}

Return ONLY the JSON object, no other text.`;

                            const extractResult = await model.generateContent(extractionPrompt);
                            const responseText = extractResult.response.text();

                            const extractedJson = responseText.match(/\{[\s\S]*\}/);
                            if (extractedJson) {
                                const extracted = JSON.parse(extractedJson[0]);
                                title = extracted.title || '';
                                description = extracted.description || '';
                                hashtags = Array.isArray(extracted.hashtags) ? extracted.hashtags.slice(0, 3) : [];
                                thumbnailPrompt = extracted.thumbnailPrompt || '';
                                theme = extracted.theme || 'other';
                                console.log(`✅ Auto-extraction successful for task ${taskId}`);
                            }
                        }
                    } catch (extractError) {
                        console.error(`⚠️ Auto-extraction failed for task ${taskId}:`, extractError);
                        // Continue without extracted data - raw result is still saved
                    }
                }

                // Update task in database
                await updateResearchTask(taskId, {
                    status: 'completed',
                    title,
                    description,
                    hashtags,
                    thumbnailPrompt,
                    researchInsights,
                    theme,
                    completedAt: new Date().toISOString()
                });

                console.log(`✅ Research completed for video ${videoId}`);

            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                await updateResearchTask(taskId, {
                    status: 'failed',
                    error: message,
                    completedAt: new Date().toISOString()
                });
                console.error(`❌ Research failed for video ${videoId}:`, message);
            }
        })();

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Get research task status by task ID
app.get('/research/task/:taskId', requireAuth, async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;

    try {
        const task = await getResearchTask(taskId);

        if (!task) {
            return res.status(404).json({ error: 'Research task not found' });
        }

        // Verify ownership
        if (task.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to view this research' });
        }

        // Format response
        res.json({
            id: task.id,
            videoId: task.videoId,
            status: task.status,
            result: task.status === 'completed' ? {
                title: task.title,
                description: task.description,
                hashtags: task.hashtags || [],
                thumbnailPrompt: task.thumbnailPrompt,
                researchInsights: task.researchInsights,
                theme: task.theme
            } : undefined,
            error: task.error,
            startedAt: task.startedAt,
            completedAt: task.completedAt
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Cancel/delete a research task
app.delete('/research/task/:taskId', requireAuth, async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;

    try {
        const task = await getResearchTask(taskId);

        if (!task) {
            return res.status(404).json({ error: 'Research task not found' });
        }

        // Verify ownership
        if (task.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to cancel this research' });
        }

        // Mark as cancelled/failed
        await updateResearchTask(taskId, {
            status: 'failed',
            error: 'Cancelled by user',
            completedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Research cancelled' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Get latest research for a video
app.get('/research/video/:videoId', requireAuth, async (req: Request, res: Response) => {
    const { videoId } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;

    try {
        // Verify video belongs to user
        const video = await getVideoById(userId, videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const task = await getLatestResearchTask(videoId);

        if (!task) {
            return res.json({ exists: false });
        }

        // Format response
        res.json({
            exists: true,
            id: task.id,
            videoId: task.videoId,
            status: task.status,
            result: task.status === 'completed' ? {
                title: task.title,
                description: task.description,
                hashtags: task.hashtags || [],
                thumbnailPrompt: task.thumbnailPrompt,
                researchInsights: task.researchInsights,
                theme: task.theme
            } : undefined,
            error: task.error,
            startedAt: task.startedAt,
            completedAt: task.completedAt
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Extract structured data from raw research using LLM
app.post('/research/extract', requireAuth, async (req: Request, res: Response) => {
    const { taskId } = req.body;
    const userId = (req as AuthenticatedRequest).user!.id;

    if (!taskId) {
        return res.status(400).json({ error: 'taskId is required' });
    }

    try {
        const task = await getResearchTask(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Research task not found' });
        }

        if (task.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Get raw research from the task
        const rawResearch = task.researchInsights;
        if (!rawResearch) {
            return res.status(400).json({ error: 'No research insights found in task' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
        }

        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const extractionPrompt = `You are a YouTube content expert. Extract structured metadata from this research content for a YouTube video.

The brand is "@faithandfork" which creates:
1. Halal food and recipes content
2. Spiritually uplifting Islamic content

RESEARCH CONTENT:
${rawResearch}

Extract and return a JSON object with these exact fields:
{
  "theme": "faith" or "food" (based on content type),
  "title": "An engaging YouTube title (max 80 chars, can use Hinglish/Urdu words like Subhanallah, Mashallah if appropriate)",
  "description": "A compelling YouTube description (200-400 words with hooks, keywords, call-to-action)",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"] (exactly 3 best performing hashtags),
  "thumbnailPrompt": "A detailed prompt for AI image generation describing the ideal thumbnail with colors, elements, text overlay suggestions"
}

Return ONLY the JSON object, no other text.`;

        const result = await model.generateContent(extractionPrompt);
        const responseText = result.response.text();

        // Parse the JSON from the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return res.status(500).json({ error: 'Failed to extract structured data' });
        }

        const extracted = JSON.parse(jsonMatch[0]);

        // Update the research task with extracted data
        await updateResearchTask(taskId, {
            title: extracted.title || '',
            description: extracted.description || '',
            hashtags: Array.isArray(extracted.hashtags) ? extracted.hashtags.slice(0, 3) : [],
            thumbnailPrompt: extracted.thumbnailPrompt || '',
            theme: extracted.theme || 'other'
        });

        res.json({
            success: true,
            extracted: {
                title: extracted.title,
                description: extracted.description,
                hashtags: extracted.hashtags,
                thumbnailPrompt: extracted.thumbnailPrompt,
                theme: extracted.theme
            }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Extraction error:', error);
        res.status(500).json({ error: message });
    }
});

// Update research task with edited data
app.put('/research/task/:taskId', requireAuth, async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const { title, description, hashtags, thumbnailPrompt } = req.body;
    const userId = (req as AuthenticatedRequest).user!.id;

    try {
        const task = await getResearchTask(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Research task not found' });
        }

        if (task.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await updateResearchTask(taskId, {
            title: title ?? task.title,
            description: description ?? task.description,
            hashtags: hashtags ?? task.hashtags,
            thumbnailPrompt: thumbnailPrompt ?? task.thumbnailPrompt
        });

        res.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Generate thumbnail using Google Gemini Image Generation (Nano Banan Pro)
app.post('/thumbnail/generate', requireAuth, async (req: Request, res: Response) => {
    const { prompt, videoId } = req.body;
    const userId = (req as AuthenticatedRequest).user!.id;

    if (!prompt) {
        return res.status(400).json({ error: 'prompt is required' });
    }

    if (videoId) {
        // Verify video ownership
        const video = await getVideoById(userId, videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }
    }

    try {
        const geminiApiKey = process.env.GEMINI_API_KEY;

        if (!geminiApiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
        }

        // Import GoogleGenAI dynamically
        const { GoogleGenAI } = await import('@google/genai');

        const ai = new GoogleGenAI({
            apiKey: geminiApiKey,
        });

        // Enhance the prompt for better YouTube thumbnail generation
        const enhancedPrompt = `Generate a YouTube thumbnail image: high quality, professional photography, vibrant saturated colors, eye-catching composition, 16:9 aspect ratio, bold text-friendly layout, dramatic lighting. Subject: ${prompt}`;

        const config = {
            responseModalities: ['IMAGE', 'TEXT'] as const,
            imageConfig: {
                imageSize: '1K' as const,
            },
            tools: [{ googleSearch: {} }],
        };

        const contents = [
            {
                role: 'user' as const,
                parts: [{ text: enhancedPrompt }],
            },
        ];

        const response = await ai.models.generateContentStream({
            model: 'gemini-3-pro-image-preview',
            config,
            contents,
        });

        let imageData: { mimeType: string; data: string } | null = null;
        let textResponse = '';

        for await (const chunk of response) {
            if (!chunk.candidates || !chunk.candidates[0]?.content?.parts) {
                continue;
            }

            const part = chunk.candidates[0].content.parts[0];
            if (part && 'inlineData' in part && part.inlineData) {
                imageData = {
                    mimeType: part.inlineData.mimeType || 'image/png',
                    data: part.inlineData.data || '',
                };
            } else if (part && 'text' in part) {
                textResponse += part.text || '';
            }
        }

        if (imageData) {
            // Return the image as a base64 data URL
            const dataUrl = `data:${imageData.mimeType};base64,${imageData.data}`;

            res.json({
                success: true,
                imageUrl: dataUrl,
                prompt: enhancedPrompt,
                textResponse: textResponse || undefined,
            });
        } else {
            throw new Error('No image generated. Response: ' + textResponse);
        }

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Thumbnail generation error:', error);
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

        // Redirect to frontend dashboard with auth tokens
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
        res.redirect(`${frontendUrl}/dashboard?token=${tokens.id_token}&userId=${userId}&email=${encodeURIComponent(email)}`);

    } catch (error: any) {
        const message = error instanceof Error ? error.message : (JSON.stringify(error) || 'Unknown error');
        console.error('Auth Error:', error);
        res.status(500).send(`Authentication failed: ${message}`);
    }
});

app.listen(PORT, async () => {
    // Initialize database schema
    try {
        await initializeDatabase();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }
    console.log(`Server running on port ${PORT}`);
});
