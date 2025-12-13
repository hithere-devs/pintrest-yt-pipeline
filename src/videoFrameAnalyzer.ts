import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';

export interface ExtractedFrame {
    index: number;
    timestamp: number;
    filePath: string;
    description?: string;
}

export interface FrameExtractionOptions {
    /** Number of frames to extract (evenly distributed) */
    frameCount?: number;
    /** Output directory for frames */
    outputDir?: string;
    /** Output image format */
    format?: 'jpg' | 'png';
    /** Quality for JPEG (1-100) */
    quality?: number;
}

export interface FrameAnalysisResult {
    frames: ExtractedFrame[];
    summary: string;
    suggestedTheme: 'food' | 'faith' | 'other';
    keyMoments: string[];
}

/**
 * Extract frames from a video file at regular intervals
 * Requires ffmpeg to be installed
 */
export async function extractFrames(
    videoPath: string,
    options: FrameExtractionOptions = {}
): Promise<ExtractedFrame[]> {
    const {
        frameCount = 5,
        outputDir = path.join(path.dirname(videoPath), 'frames'),
        format = 'jpg',
        quality = 85,
    } = options;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get video duration first
    const duration = await getVideoDuration(videoPath);
    if (duration <= 0) {
        throw new Error('Could not determine video duration');
    }

    const interval = duration / (frameCount + 1);
    const frames: ExtractedFrame[] = [];

    for (let i = 1; i <= frameCount; i++) {
        const timestamp = interval * i;
        const outputFile = path.join(outputDir, `frame_${i.toString().padStart(3, '0')}.${format}`);

        await extractSingleFrame(videoPath, timestamp, outputFile, quality);

        frames.push({
            index: i,
            timestamp,
            filePath: outputFile,
        });
    }

    console.log(`📸 Extracted ${frames.length} frames from video`);
    return frames;
}

/**
 * Get video duration using ffprobe
 */
async function getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            videoPath
        ]);

        let output = '';
        let error = '';

        ffprobe.stdout.on('data', (data) => {
            output += data.toString();
        });

        ffprobe.stderr.on('data', (data) => {
            error += data.toString();
        });

        ffprobe.on('close', (code) => {
            if (code === 0) {
                const duration = parseFloat(output.trim());
                resolve(isNaN(duration) ? 0 : duration);
            } else {
                reject(new Error(`ffprobe failed: ${error}`));
            }
        });

        ffprobe.on('error', (err) => {
            reject(new Error(`ffprobe not found: ${err.message}`));
        });
    });
}

/**
 * Extract a single frame at a specific timestamp
 */
async function extractSingleFrame(
    videoPath: string,
    timestamp: number,
    outputPath: string,
    quality: number
): Promise<void> {
    return new Promise((resolve, reject) => {
        const args = [
            '-ss', timestamp.toString(),
            '-i', videoPath,
            '-vframes', '1',
            '-q:v', Math.round((100 - quality) / 3.33).toString(), // Convert quality to ffmpeg scale
            '-y',
            outputPath
        ];

        const ffmpeg = spawn('ffmpeg', args);

        let error = '';
        ffmpeg.stderr.on('data', (data) => {
            error += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`ffmpeg failed to extract frame: ${error}`));
            }
        });

        ffmpeg.on('error', (err) => {
            reject(new Error(`ffmpeg not found: ${err.message}`));
        });
    });
}

/**
 * Analyze frames using Gemini Vision API
 */
export async function analyzeFrames(frames: ExtractedFrame[]): Promise<ExtractedFrame[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('GEMINI_API_KEY not found, skipping frame analysis');
        return frames;
    }

    const ai = new GoogleGenAI({ apiKey });

    const analyzedFrames: ExtractedFrame[] = [];

    for (const frame of frames) {
        try {
            // Read the image file
            const imageData = fs.readFileSync(frame.filePath);
            const base64Image = imageData.toString('base64');
            const mimeType = frame.filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

            const contents = [
                {
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType,
                                data: base64Image,
                            },
                        },
                        {
                            text: `Describe this video frame in 1-2 sentences. Focus on:
1. What is shown (food, Islamic scene, people, etc.)
2. The mood/atmosphere
3. Any text or key elements visible

Keep the description concise and factual.`
                        },
                    ],
                },
            ];

            const streamResult = await ai.models.generateContentStream({
                model: 'gemini-3-pro-preview',
                contents,
                config: { thinkingConfig: { thinkingLevel: 'HIGH' } }
            });
            let description = '';
            for await (const chunk of streamResult) {
                if (chunk.text) description += chunk.text;
            }
            analyzedFrames.push({
                ...frame,
                description,
            });

            console.log(`   Frame ${frame.index}: ${description.substring(0, 100)}...`);
        } catch (error) {
            console.warn(`Failed to analyze frame ${frame.index}:`, error);
            analyzedFrames.push(frame);
        }
    }

    return analyzedFrames;
}

/**
 * Full frame analysis pipeline: extract frames, analyze them, and return insights
 */
export async function analyzeVideoFrames(
    videoPath: string,
    options: FrameExtractionOptions = {}
): Promise<FrameAnalysisResult> {
    console.log('🎬 Starting video frame analysis...');

    // Extract frames
    const frames = await extractFrames(videoPath, options);

    // Analyze each frame
    console.log('🔍 Analyzing frames with AI...');
    const analyzedFrames = await analyzeFrames(frames);

    // Generate summary from frame descriptions
    const descriptions = analyzedFrames
        .filter(f => f.description)
        .map(f => `Frame ${f.index} (${f.timestamp.toFixed(1)}s): ${f.description}`);

    // Determine theme based on descriptions
    const combinedText = descriptions.join(' ').toLowerCase();
    let suggestedTheme: 'food' | 'faith' | 'other' = 'other';

    const foodKeywords = ['food', 'recipe', 'cooking', 'kitchen', 'dish', 'meal', 'ingredient', 'delicious', 'biryani', 'chicken', 'rice'];
    const faithKeywords = ['mosque', 'prayer', 'islamic', 'quran', 'makkah', 'madinah', 'muslim', 'allah', 'spiritual', 'peaceful'];

    const foodScore = foodKeywords.filter(k => combinedText.includes(k)).length;
    const faithScore = faithKeywords.filter(k => combinedText.includes(k)).length;

    if (foodScore > faithScore && foodScore > 0) {
        suggestedTheme = 'food';
    } else if (faithScore > foodScore && faithScore > 0) {
        suggestedTheme = 'faith';
    }

    // Extract key moments (frames with most descriptive content)
    const keyMoments = analyzedFrames
        .filter(f => f.description && f.description.length > 50)
        .slice(0, 3)
        .map(f => f.description!);

    return {
        frames: analyzedFrames,
        summary: descriptions.join('\n'),
        suggestedTheme,
        keyMoments,
    };
}

/**
 * Clean up extracted frame files
 */
export async function cleanupFrames(frames: ExtractedFrame[]): Promise<void> {
    for (const frame of frames) {
        try {
            if (fs.existsSync(frame.filePath)) {
                fs.unlinkSync(frame.filePath);
            }
        } catch (error) {
            console.warn(`Failed to delete frame file ${frame.filePath}:`, error);
        }
    }

    // Try to remove the frames directory if empty
    if (frames.length > 0) {
        const frameDir = path.dirname(frames[0].filePath);
        try {
            const remaining = fs.readdirSync(frameDir);
            if (remaining.length === 0) {
                fs.rmdirSync(frameDir);
            }
        } catch {
            // Ignore errors when removing directory
        }
    }
}
