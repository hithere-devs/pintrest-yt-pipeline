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
import {
    createAsset,
    getAssetsByType,
    getAssetById,
    updateAsset,
    deleteAsset,
    searchAssets,
    createProject,
    getProjectById,
    getProjectsByUser,
    updateProject,
    deleteProject,
    createScheduledVideo,
    getScheduledVideosByUser,
    getPendingScheduledVideos,
    updateScheduledVideo,
    deleteScheduledVideo,
    getProjectWithAssets,
    type AssetType,
    type DbAsset,
    type DbViralVideoProject,
    type DbScheduledVideo,
    type CaptionSettings,
} from './db/viralVideo';
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
import { uploadFrames, isS3Configured, deleteFramesFromGCS as deleteFramesFromS3, uploadToS3 } from './gcsClient';

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
            console.log('☁️ Uploading frames to GCS...');
            const gcsResults = await uploadFrames(videoId, frames.map(f => ({
                filePath: f.filePath,
                index: f.index,
                timestamp: f.timestamp
            })));

            frameDataForDb = gcsResults.map((gcsFrame, idx) => ({
                index: gcsFrame.index,
                timestamp: gcsFrame.timestamp,
                s3Url: gcsFrame.gcsUrl,
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
                            const { GoogleGenAI, ThinkingLevel } = await import('@google/genai');
                            const ai = new GoogleGenAI({ apiKey });

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

                            const contents = [{ role: 'user', parts: [{ text: extractionPrompt }] }];
                            const streamResult = await ai.models.generateContentStream({
                                model: 'gemini-3-pro-preview',
                                contents,
                                config: { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
                            });
                            let responseText = '';
                            for await (const chunk of streamResult) {
                                if (chunk.text) responseText += chunk.text;
                            }

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

        const { GoogleGenAI, ThinkingLevel } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

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

        const contents = [{ role: 'user', parts: [{ text: extractionPrompt }] }];
        const streamResult = await ai.models.generateContentStream({
            model: 'gemini-3-pro-preview',
            contents,
            config: { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
        });
        let responseText = '';
        for await (const chunk of streamResult) {
            if (chunk.text) responseText += chunk.text;
        }

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
            responseModalities: ['IMAGE', 'TEXT'] as string[],
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

// ============= Viral Video Generator APIs =============

// Get all assets by type (video, music, voice)
app.get('/assets/:type', requireAuth, async (req: Request, res: Response) => {
    const { type } = req.params;
    const { search, tags } = req.query;

    if (!['video', 'music', 'voice'].includes(type)) {
        return res.status(400).json({ error: 'Invalid asset type. Must be video, music, or voice' });
    }

    try {
        let assets: DbAsset[];
        if (search || tags) {
            const tagArray = tags ? (tags as string).split(',') : undefined;
            assets = await searchAssets(type as AssetType, search as string, tagArray);
        } else {
            assets = await getAssetsByType(type as AssetType);
        }
        res.json({ assets });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Get single asset by ID
app.get('/asset/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const asset = await getAssetById(id);
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        res.json({ asset });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Upload a new asset (admin endpoint - could add role check later)
app.post('/assets', requireAuth, async (req: Request, res: Response) => {
    const { type, name, description, s3Key, s3Url, thumbnailUrl, duration, metadata, tags } = req.body;

    if (!type || !name || !s3Key || !s3Url) {
        return res.status(400).json({ error: 'type, name, s3Key, and s3Url are required' });
    }

    if (!['video', 'music', 'voice'].includes(type)) {
        return res.status(400).json({ error: 'Invalid asset type. Must be video, music, or voice' });
    }

    try {
        const asset = await createAsset({
            type,
            name,
            description,
            s3Key,
            s3Url,
            thumbnailUrl,
            duration,
            metadata,
            tags,
        });
        res.status(201).json({ asset });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Update an asset
app.put('/asset/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    try {
        const asset = await updateAsset(id, updates);
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        res.json({ asset });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Delete an asset
app.delete('/asset/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        await deleteAsset(id);
        res.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// ============= Caption Testing API =============

// Generate a quick test video with caption settings
// Uses hardcoded GCS URLs for testing caption styles
app.post('/test/caption-preview', requireAuth, async (req: Request, res: Response) => {
    // ============================================
    // HARDCODED TEST VALUES - EDIT THESE DIRECTLY
    // ============================================
    const FONTSIZE = 16;           // ASS font size (try: 10-40)
    const FONTNAME = 'Avenir Next';      // Font name
    const PRIMARY_COLOUR = '&H00FFFFFF';  // White (ASS BGR format: &HAABBGGRR)
    const OUTLINE_COLOUR = '&H00000000';  // Black outline
    const BACK_COLOUR = '&H40000000';     // Semi-transparent black background
    const OUTLINE = 2;             // Outline thickness (try: 1-4)
    const SHADOW = 0;              // Shadow (0 = off)
    const BOLD = 1;                // Bold (1 = on, 0 = off)
    const ALIGNMENT = 2;           // 1-9 numpad layout (2=bottom-center, 5=center, 8=top-center)
    const MARGIN_L = 20;           // Left margin
    const MARGIN_R = 20;           // Right margin
    const MARGIN_V = 200;          // Vertical margin from anchor point

    // Hardcoded URLs
    const VIDEO_URL = 'https://storage.googleapis.com/video-pipeline-assets/assets/videos/minecraft-parkour.mp4';
    const AUDIO_URL = 'https://storage.googleapis.com/video-pipeline-assets/voiceovers/8173aedf-0fb1-4ed0-8a81-fdab06ba07b0/1766334884727.mp3';

    const WORDS_PER_CAPTION = 4;

    // Script lines for captions (from the voiceover)
    const SCRIPT = [
        "This beautiful green dress was actually killing the woman wearing it.",
        "In the Victorian era a new dye called Paris Green became the ultimate fashion obsession.",
        "It was vibrant and bright and even glowed under gaslight.",
        "But there was a deadly secret because to get that color dressmakers used massive amounts of arsenic.",
        "A single ball gown could contain enough poison to kill dozens of people.",
        "As women danced the arsenic dust would shake off and poison them slowly causing headaches and sores.",
        "But the seamstresses had it worse because they died horrific deaths just from touching the fabric.",
        "Despite warnings people kept wearing it because dying for fashion was literal back then.",
        "Subscribe to discover more dark secrets from history.",
    ];

    // Split the joined script into lines with WORDS_PER_CAPTION words each
    // Respect full stops to avoid splitting sentences across captions
    const words = SCRIPT.join(' ').split(/\s+/);
    const SCRIPT_LINES = [];
    let currentChunk: string[] = [];

    for (const word of words) {
        currentChunk.push(word);
        if (word.endsWith('.') || currentChunk.length >= WORDS_PER_CAPTION) {
            SCRIPT_LINES.push(currentChunk.join(' '));
            currentChunk = [];
        }
    }
    if (currentChunk.length > 0) {
        SCRIPT_LINES.push(currentChunk.join(' '));
    }

    console.log(SCRIPT_LINES)


    const ESTIMATED_DURATION = 45; // seconds total
    // ============================================

    try {
        const os = await import('os');
        const { spawn } = await import('child_process');

        // Create temp directory
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'caption-test-'));

        // Download video
        console.log(`🎬 Downloading video from: ${VIDEO_URL}`);
        const inputVideo = path.join(tempDir, 'background.mp4');
        const videoResponse = await fetch(VIDEO_URL);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.status}`);
        }
        const bgVideoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        fs.writeFileSync(inputVideo, bgVideoBuffer);
        console.log(`   Downloaded: ${bgVideoBuffer.length} bytes`);

        // Download audio
        console.log(`🎤 Downloading audio from: ${AUDIO_URL}`);
        const voiceoverPath = path.join(tempDir, 'voiceover.mp3');
        const voResponse = await fetch(AUDIO_URL);
        if (!voResponse.ok) {
            throw new Error(`Failed to download audio: ${voResponse.status}`);
        }
        const voBuffer = Buffer.from(await voResponse.arrayBuffer());
        fs.writeFileSync(voiceoverPath, voBuffer);
        console.log(`   Downloaded: ${voBuffer.length} bytes`);

        // Generate SRT from script lines with estimated timing
        const avgLineTime = ESTIMATED_DURATION / SCRIPT_LINES.length;
        let srtContent = '';
        let currentTime = 0;

        for (let i = 0; i < SCRIPT_LINES.length; i++) {
            const text = SCRIPT_LINES[i];
            const startTime = currentTime;
            const endTime = currentTime + avgLineTime - 0.1;

            const formatTime = (s: number) => {
                const hrs = Math.floor(s / 3600);
                const mins = Math.floor((s % 3600) / 60);
                const secs = Math.floor(s % 60);
                const ms = Math.floor((s % 1) * 1000);
                return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
            };

            srtContent += `${i + 1}\n${formatTime(startTime)} --> ${formatTime(endTime)}\n${text}\n\n`;
            currentTime += avgLineTime;
        }

        const srtPath = path.join(tempDir, 'test.srt');
        const outputPath = path.join(tempDir, 'test-output.mp4');
        fs.writeFileSync(srtPath, srtContent, 'utf8');
        console.log(`📝 Generated SRT with ${SCRIPT_LINES.length} captions`);

        // Build ASS style from hardcoded values
        const styleParams = [
            `Fontname=${FONTNAME}`,
            `Fontsize=${FONTSIZE}`,
            `PrimaryColour=${PRIMARY_COLOUR}`,
            `OutlineColour=${OUTLINE_COLOUR}`,
            `BackColour=${BACK_COLOUR}`,
            `Bold=${BOLD}`,
            `Outline=${OUTLINE}`,
            `Shadow=${SHADOW}`,
            `Alignment=${ALIGNMENT}`,
            `MarginL=${MARGIN_L}`,
            `MarginR=${MARGIN_R}`,
            `MarginV=${MARGIN_V}`,
        ].join(',');

        const escapedSrtPath = srtPath.replace(/'/g, "'\\''").replace(/:/g, '\\:');
        const subtitleFilter = `subtitles='${escapedSrtPath}':force_style='${styleParams}'`;

        // Build FFmpeg args
        const args: string[] = [
            '-i', inputVideo,
            '-i', voiceoverPath,
            '-t', String(ESTIMATED_DURATION),
            '-vf', subtitleFilter,
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
            '-map', '0:v:0', '-map', '1:a:0',
            '-c:a', 'aac', '-b:a', '128k',
            '-y', outputPath,
        ];

        console.log('🧪 Generating caption test video...');
        console.log(`   Style: ${styleParams}`);

        // Run FFmpeg
        await new Promise<void>((resolve, reject) => {
            const proc = spawn('ffmpeg', args);
            let stderr = '';
            proc.stderr?.on('data', (data) => { stderr += data.toString(); });
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`FFmpeg failed: ${stderr.slice(-300)}`));
            });
            proc.on('error', reject);
        });

        // Read the output file and send as base64 data URL
        const videoBuffer = fs.readFileSync(outputPath);
        const base64Video = videoBuffer.toString('base64');
        const videoDataUrl = `data:video/mp4;base64,${base64Video}`;

        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });

        console.log('✅ Caption test video generated');
        res.json({ videoUrl: videoDataUrl });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Caption test error:', message);
        res.status(500).json({ error: message });
    }
});

// ============= Viral Video Project APIs =============

// Create a new project
app.post('/viral/projects', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { name, backgroundVideoId, musicId } = req.body;

    try {
        const project = await createProject({
            userId,
            name,
            backgroundVideoId,
            musicId,
        });
        res.status(201).json({ project });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Get all projects for user
app.get('/viral/projects', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { status } = req.query;

    try {
        const projects = await getProjectsByUser(userId, status as any);
        res.json({ projects });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Get single project with assets
app.get('/viral/project/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;

    try {
        const result = await getProjectWithAssets(id);
        if (!result) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Verify ownership
        if (result.project.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to access this project' });
        }

        res.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Update a project
app.put('/viral/project/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;
    const updates = req.body;

    try {
        // Verify ownership first
        const existing = await getProjectById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (existing.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to update this project' });
        }

        const project = await updateProject(id, updates);
        res.json({ project });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Delete a project
app.delete('/viral/project/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;

    try {
        const existing = await getProjectById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (existing.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to delete this project' });
        }

        await deleteProject(id);
        res.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// ============= Scheduled Video APIs =============

// Create a scheduled video
app.post('/viral/schedule', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { projectId, scheduledAt, youtubeTitle, youtubeDescription, youtubeTags, youtubePrivacy } = req.body;

    if (!projectId || !scheduledAt) {
        return res.status(400).json({ error: 'projectId and scheduledAt are required' });
    }

    try {
        // Verify project ownership
        const project = await getProjectById(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (project.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to schedule this project' });
        }

        const scheduled = await createScheduledVideo({
            projectId,
            userId,
            scheduledAt: new Date(scheduledAt),
            youtubeTitle,
            youtubeDescription,
            youtubeTags,
            youtubePrivacy,
        });
        res.status(201).json({ scheduled });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Get all scheduled videos for user
app.get('/viral/schedules', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;

    try {
        const schedules = await getScheduledVideosByUser(userId);
        res.json({ schedules });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Update a scheduled video
app.put('/viral/schedule/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).user!.id;
    const updates = req.body;

    try {
        // We don't have a direct getScheduledVideoById, so we'll update and check
        const scheduled = await updateScheduledVideo(id, updates);
        if (!scheduled) {
            return res.status(404).json({ error: 'Scheduled video not found' });
        }
        if (scheduled.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to update this schedule' });
        }

        res.json({ scheduled });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Delete a scheduled video
app.delete('/viral/schedule/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        await deleteScheduledVideo(id);
        res.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// Get available voice profiles (ElevenLabs voices)
app.get('/viral/voices', requireAuth, async (_req: Request, res: Response) => {
    // This will be populated from ElevenLabs API or pre-configured list
    const voices = [
        { id: 'stewie', name: 'Stewie Griffin', description: 'Intelligent, sarcastic baby voice', preview: null },
        { id: 'peter', name: 'Peter Griffin', description: 'Lovable oaf with distinctive laugh', preview: null },
        { id: 'narrator', name: 'Deep Narrator', description: 'Professional documentary style', preview: null },
        { id: 'energetic', name: 'Energetic Host', description: 'High energy, enthusiastic', preview: null },
        { id: 'calm', name: 'Calm Storyteller', description: 'Soothing, relaxed narration', preview: null },
    ];
    res.json({ voices });
});

// Generate viral script using Gemini (simple, fast)
app.post('/viral/generate-script', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const {
        projectId,
        topic,
        format = 'monologue',
        duration = 60,
        voiceStyle = 'energetic',
        targetAudience = 'general',
        platform = 'youtube_shorts',
        additionalContext,
        speakers
    } = req.body;

    if (!topic) {
        return res.status(400).json({ error: 'topic is required' });
    }

    try {
        const { GoogleGenAI, ThinkingLevel } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

        const platformGuideMap: Record<string, string> = {
            youtube_shorts: 'YouTube Shorts (under 60 seconds, vertical 9:16, hook in first 2 seconds)',
            youtube: 'YouTube (longer form, can be horizontal)',
            tiktok: 'TikTok (under 60 seconds, trendy, fast-paced)',
            instagram_reels: 'Instagram Reels (under 90 seconds, visually appealing)',
        };
        const platformGuide = platformGuideMap[platform] || 'short-form video';

        const formatGuideMap: Record<string, string> = {
            monologue: 'single narrator speaking directly to camera',
            dialogue: `conversation between ${speakers?.length || 2} characters`,
            narration: 'documentary-style narration over visuals',
        };
        const formatGuide = formatGuideMap[format] || 'monologue';

        const prompt = `Generate a viral ${platformGuide} script about: "${topic}"

Format: ${formatGuide}
Voice Style: ${voiceStyle}
Target Duration: ${duration} seconds
Target Audience: ${targetAudience}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}

CRITICAL REQUIREMENTS:
1. Start with a HOOK that grabs attention in the first 2 seconds
2. Keep it engaging and fast-paced
3. Use simple, conversational language
4. End with a strong call-to-action
5. Make it emotional/relatable

IMPORTANT - TEXT FORMATTING RULES:
- DO NOT use any emojis, emoticons, or special symbols (no 😀, 🔥, ❤️, etc.)
- DO NOT use asterisks for emphasis (*word*)
- DO NOT use hashtag symbols in the script text
- Write numbers as words when spoken (e.g., "five" not "5")
- Spell out abbreviations (e.g., "dollars" not "$")
- Use plain English text only - this will be converted to speech
- Avoid parenthetical expressions or stage directions
- Each line should be natural spoken dialogue

Return a JSON object with this exact structure:
{
  "script": "The full script text to be spoken - plain text only, no emojis or special characters",
  "hookLine": "The opening hook line",
  "callToAction": "The ending call to action",
  "estimatedDuration": ${duration},
  "suggestedMusic": "Type of background music that would work well",
  "lines": [
    {"speaker": "narrator", "text": "line text in plain spoken English", "emotion": "excited"}
  ],
  "hashtags": ["relevant", "hashtags"]
}

Only return valid JSON, no markdown or extra text.`;

        const contents = [{ role: 'user', parts: [{ text: prompt }] }];
        const streamResult = await ai.models.generateContentStream({
            model: 'gemini-3-pro-preview',
            contents,
            config: { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
        });
        let responseText = '';
        for await (const chunk of streamResult) {
            if (chunk.text) responseText += chunk.text;
        }

        // Clean up response and parse JSON
        let cleanJson = responseText.trim();
        if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.slice(7);
        }
        if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.slice(3);
        }
        if (cleanJson.endsWith('```')) {
            cleanJson = cleanJson.slice(0, -3);
        }
        cleanJson = cleanJson.trim();

        const scriptResult = JSON.parse(cleanJson);

        // If projectId provided, update the project
        if (projectId) {
            await updateProject(projectId, {
                scriptContent: scriptResult.script,
                scriptType: format,
                researchPrompt: topic,
                researchResult: JSON.stringify(scriptResult),
                status: 'draft',
            });
        }

        res.json({
            success: true,
            script: scriptResult
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Script generation error:', error);
        res.status(500).json({ error: message });
    }
});

// Generate random viral video idea
app.post('/viral/random-idea', requireAuth, async (req: Request, res: Response) => {
    const { category } = req.body;

    try {
        const { GoogleGenAI, ThinkingLevel } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

        const categoryHint = category ? `in the category of "${category}"` : '';

        const prompt = `Generate a unique, viral-worthy short video idea ${categoryHint} for YouTube Shorts/TikTok/Reels.

The idea should be:
- Attention-grabbing and scroll-stopping
- Easy to produce with stock footage or simple visuals
- Emotionally engaging (funny, shocking, inspiring, or educational)
- Trending or evergreen topic

Return ONLY a JSON object with this structure (no markdown, no extra text):
{
  "idea": "A catchy, specific video topic in 10-20 words",
  "hook": "The opening line/hook for the video",
  "category": "Category like: facts, motivation, humor, life-hacks, storytelling, mystery",
  "viralPotential": "Why this could go viral in 1 sentence"
}`;

        const contents = [{ role: 'user', parts: [{ text: prompt }] }];
        const streamResult = await ai.models.generateContentStream({
            model: 'gemini-3-pro-preview',
            contents,
            config: { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
        });
        let responseText = '';
        for await (const chunk of streamResult) {
            if (chunk.text) responseText += chunk.text;
        }

        let cleanJson = responseText.trim();
        if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
        if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
        if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
        cleanJson = cleanJson.trim();

        const idea = JSON.parse(cleanJson);

        res.json({ success: true, ...idea });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Random idea generation error:', error);
        res.status(500).json({ error: message });
    }
});

// Generate voiceover from script
app.post('/viral/generate-voiceover', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { projectId, script, voiceId, lines } = req.body;

    if (!projectId || (!script && !lines)) {
        return res.status(400).json({ error: 'projectId and (script or lines) are required' });
    }

    try {
        // Verify project ownership
        const project = await getProjectById(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (project.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to modify this project' });
        }

        // Update status
        await updateProject(projectId, { status: 'generating_voiceover' });

        // Import TTS service
        const { generateSpeechToS3, generateDialogue } = await import('./ttsService');

        let result;
        if (lines && Array.isArray(lines)) {
            // Multi-speaker dialogue
            result = await generateDialogue(lines, projectId);
            // For dialogue, we'd need to concatenate the audio files
            // For now, just return the first one
            const firstResult = result[0];
            await updateProject(projectId, {
                voiceoverS3Key: firstResult.s3Key,
                voiceoverS3Url: firstResult.s3Url,
                voiceoverDuration: firstResult.duration,
                voiceId: voiceId || 'narrator',
                status: 'draft',
            });
            res.json({ success: true, voiceover: firstResult, allParts: result });
        } else {
            // Single voice with word-level timestamps
            result = await generateSpeechToS3(script, voiceId || 'narrator', projectId);
            await updateProject(projectId, {
                voiceoverS3Key: result.s3Key,
                voiceoverS3Url: result.s3Url,
                voiceoverDuration: result.duration,
                voiceId: voiceId || 'narrator',
                wordTimings: result.wordTimings ? JSON.stringify(result.wordTimings) : undefined,
                status: 'draft',
            });
            res.json({ success: true, voiceover: result });
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Voiceover generation error:', error);

        // Update project status to failed
        if (req.body.projectId) {
            await updateProject(req.body.projectId, {
                status: 'failed',
                errorMessage: message
            });
        }

        res.status(500).json({ error: message });
    }
});

// Composite final video
app.post('/viral/composite', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { projectId } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
    }

    try {
        // Get project with assets
        const projectData = await getProjectWithAssets(projectId);
        if (!projectData) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (projectData.project.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to modify this project' });
        }

        const { project, backgroundVideo, music } = projectData;

        // Validate required assets
        if (!backgroundVideo) {
            return res.status(400).json({ error: 'Background video not selected' });
        }
        if (!project.voiceoverS3Url) {
            return res.status(400).json({ error: 'Voiceover not generated' });
        }

        // Update status
        await updateProject(projectId, { status: 'compositing' });

        // Import compositor
        const { compositeAndUpload } = await import('./videoCompositor');

        // Parse script lines from research result
        let scriptLines = [];
        try {
            const researchResult = project.researchResult ? JSON.parse(project.researchResult) : null;
            scriptLines = researchResult?.lines || [];
        } catch {
            // If no lines, create a simple one from script content
            if (project.scriptContent) {
                scriptLines = [{ speaker: 'narrator', text: project.scriptContent }];
            }
        }

        // Download assets to temp files for processing
        const fs = await import('fs');
        const path = await import('path');
        const os = await import('os');
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viral-composite-'));

        // Download background video
        const backgroundVideoPath = path.join(tempDir, 'background.mp4');
        const bgResponse = await fetch(backgroundVideo.s3Url);
        const bgBuffer = Buffer.from(await bgResponse.arrayBuffer());
        fs.writeFileSync(backgroundVideoPath, bgBuffer);

        // Download voiceover
        const voiceoverPath = path.join(tempDir, 'voiceover.mp3');
        console.log(`📥 Downloading voiceover from: ${project.voiceoverS3Url}`);
        const voResponse = await fetch(project.voiceoverS3Url);
        if (!voResponse.ok) {
            throw new Error(`Failed to download voiceover: ${voResponse.status} ${voResponse.statusText}`);
        }
        const voBuffer = Buffer.from(await voResponse.arrayBuffer());
        console.log(`   Voiceover downloaded: ${voBuffer.length} bytes`);
        if (voBuffer.length === 0) {
            throw new Error('Voiceover file is empty');
        }
        fs.writeFileSync(voiceoverPath, voBuffer);
        console.log(`   Voiceover saved to: ${voiceoverPath}`);

        // Download music if available
        let musicPath: string | undefined;
        if (music) {
            musicPath = path.join(tempDir, 'music.mp3');
            const musicResponse = await fetch(music.s3Url);
            const musicBuffer = Buffer.from(await musicResponse.arrayBuffer());
            fs.writeFileSync(musicPath, musicBuffer);
        }

        // Parse word timings if available
        let wordTimings;
        if (project.wordTimings) {
            try {
                wordTimings = JSON.parse(project.wordTimings);
                console.log(`📝 Using ${wordTimings.length} word timings for precise caption sync`);
            } catch {
                console.log('⚠️ Could not parse word timings, using estimated timing');
            }
        }

        // Composite video
        const result = await compositeAndUpload({
            backgroundVideoPath,
            voiceoverPath,
            musicPath,
            captionSettings: project.captionSettings as any,
            scriptLines,
            wordTimings,
        }, projectId);

        // Cleanup temp files
        try {
            fs.unlinkSync(backgroundVideoPath);
            fs.unlinkSync(voiceoverPath);
            if (musicPath) fs.unlinkSync(musicPath);
            fs.rmdirSync(tempDir);
        } catch {
            // Ignore cleanup errors
        }

        if (!result.success) {
            throw new Error(result.error || 'Composition failed');
        }

        // Update project with final video
        await updateProject(projectId, {
            finalVideoS3Key: result.s3Key,
            finalVideoS3Url: result.s3Url,
            finalVideoDuration: result.duration,
            status: 'completed',
            completedAt: new Date().toISOString(),
        });

        res.json({ success: true, video: result });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Video composition error:', error);

        await updateProject(projectId, {
            status: 'failed',
            errorMessage: message
        });

        res.status(500).json({ error: message });
    }
});

// Research trending topics
app.get('/viral/trending', requireAuth, async (req: Request, res: Response) => {
    const { niche, platform, count } = req.query;

    try {
        const { researchTrendingTopics } = await import('./deepResearch');

        const topics = await researchTrendingTopics({
            niche: niche as string,
            platform: platform as string,
            count: count ? parseInt(count as string) : 5,
        });

        res.json({ topics });
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

        // Redirect to frontend dashboard with auth tokens
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
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
