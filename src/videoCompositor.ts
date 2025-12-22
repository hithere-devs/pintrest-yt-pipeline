import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { uploadToS3 } from './gcsClient';

export interface CaptionSettings {
    font: string;
    fontSize: number;
    fontColor: string;
    strokeColor: string;
    strokeWidth: number;
    position: 'top' | 'center' | 'bottom';
    animation: 'none' | 'fade' | 'slide' | 'bounce';
}

export interface ScriptLine {
    speaker: string;
    text: string;
    startTime?: number;
    endTime?: number;
    emotion?: string;
}

export interface CompositionInput {
    backgroundVideoPath: string;
    voiceoverPath: string;
    musicPath?: string;
    captionSettings: CaptionSettings;
    scriptLines: ScriptLine[];
    wordTimings?: WordTiming[];  // Precise word-level timings from TTS
    outputPath?: string;
    musicVolume?: number; // 0-1, default 0.2
    voiceoverVolume?: number; // 0-1, default 1.0
    wordsPerCaption?: number; // 1-4, default 2 for viral style
}

export interface CompositionResult {
    outputPath: string;
    s3Key?: string;
    s3Url?: string;
    duration: number;
    success: boolean;
    error?: string;
}

/**
 * Get video duration using ffprobe
 */
export async function getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        // Check if file exists first
        if (!fs.existsSync(videoPath)) {
            reject(new Error(`File not found: ${videoPath}`));
            return;
        }

        // Check file size
        const stats = fs.statSync(videoPath);
        if (stats.size === 0) {
            reject(new Error(`File is empty: ${videoPath}`));
            return;
        }

        console.log(`   ffprobe checking: ${videoPath} (${stats.size} bytes)`);

        const args = [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            videoPath
        ];

        const process = spawn('ffprobe', args);
        let output = '';
        let errorOutput = '';

        process.stdout.on('data', (data) => {
            output += data.toString();
        });

        process.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                const duration = parseFloat(output.trim());
                resolve(isNaN(duration) ? 0 : duration);
            } else {
                reject(new Error(`ffprobe exited with code ${code}: ${errorOutput || 'No error output'}`));
            }
        });

        process.on('error', (err) => {
            reject(new Error(`ffprobe failed to start: ${err.message}`));
        });
    });
}

/**
 * Get audio duration using ffprobe
 */
export async function getAudioDuration(audioPath: string): Promise<number> {
    return getVideoDuration(audioPath);
}

/**
 * Word timing from TTS service
 */
export interface WordTiming {
    word: string;
    start: number;
    end: number;
}

/**
 * Generate SRT subtitle file from word timings (precise sync)
 * Groups words into short phrases (1-2 words) for viral style
 */
export function generateSRTFromWordTimings(wordTimings: WordTiming[], wordsPerCaption: number = 1): string {
    let srt = '';
    let captionIndex = 1;

    for (let i = 0; i < wordTimings.length; i += wordsPerCaption) {
        const chunk = wordTimings.slice(i, i + wordsPerCaption);
        if (chunk.length === 0) continue;

        const startTime = chunk[0].start;
        const endTime = chunk[chunk.length - 1].end;
        const text = chunk.map(w => w.word).join(' ');

        srt += `${captionIndex}\n`;
        srt += `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n`;
        srt += `${text}\n\n`;

        captionIndex++;
    }

    return srt;
}

/**
 * Generate SRT subtitle file from script lines (fallback for no word timings)
 */
export function generateSRT(lines: ScriptLine[]): string {
    let srt = '';
    let currentTime = 0;

    lines.forEach((line, index) => {
        const startTime = line.startTime ?? currentTime;
        // Estimate duration based on word count (roughly 150 words per minute)
        const wordCount = line.text.split(/\s+/).length;
        const estimatedDuration = (wordCount / 150) * 60;
        const endTime = line.endTime ?? (startTime + estimatedDuration);

        srt += `${index + 1}\n`;
        srt += `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n`;
        srt += `${line.text}\n\n`;

        currentTime = endTime + 0.1; // Small gap between subtitles
    });

    return srt;
}

/**
 * Format time for SRT format (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${padZero(hours)}:${padZero(minutes)}:${padZero(secs)},${padZero(millis, 3)}`;
}

function padZero(num: number, length: number = 2): string {
    return num.toString().padStart(length, '0');
}

/**
 * Get position filter for captions
 */
function getCaptionPositionY(position: 'top' | 'center' | 'bottom', fontSize: number): string {
    switch (position) {
        case 'top':
            return `y=${fontSize * 2}`;
        case 'center':
            return 'y=(h-text_h)/2';
        case 'bottom':
            return `y=h-${fontSize * 3}`;
        default:
            return `y=h-${fontSize * 3}`;
    }
}

/**
 * Loop video to match audio duration
 */
async function loopVideoToLength(
    inputVideo: string,
    targetDuration: number,
    outputPath: string
): Promise<void> {
    return new Promise((resolve, reject) => {
        // Use stream_loop to loop the video
        const args = [
            '-stream_loop', '-1',
            '-i', inputVideo,
            '-t', targetDuration.toString(),
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-an', // Remove audio from background video
            '-y',
            outputPath
        ];

        console.log(`🔄 Looping video to ${targetDuration}s: ffmpeg ${args.join(' ')}`);

        const process = spawn('ffmpeg', args);
        let stderr = '';

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFmpeg loop failed: ${stderr}`));
            }
        });

        process.on('error', reject);
    });
}

/**
 * Composite a viral video with background, voiceover, music, and captions
 */
export async function compositeVideo(input: CompositionInput): Promise<CompositionResult> {
    const {
        backgroundVideoPath,
        voiceoverPath,
        musicPath,
        captionSettings,
        scriptLines,
        wordTimings,
        outputPath: customOutputPath,
        musicVolume = 0.2,
        voiceoverVolume = 1.0,
        wordsPerCaption = 2, // Default 2 words for viral style like "This beautiful"
    } = input;

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viral-video-'));
    const outputPath = customOutputPath || path.join(tempDir, `output-${Date.now()}.mp4`);

    try {
        // Step 1: Get audio duration
        console.log('📊 Getting voiceover duration...');
        const voiceoverDuration = await getAudioDuration(voiceoverPath);
        console.log(`   Voiceover duration: ${voiceoverDuration}s`);

        // Step 2: Loop background video to match audio length (add 2 seconds buffer)
        const targetDuration = voiceoverDuration + 2;
        const loopedVideoPath = path.join(tempDir, 'looped-background.mp4');
        console.log('🔄 Looping background video...');
        await loopVideoToLength(backgroundVideoPath, targetDuration, loopedVideoPath);

        // Step 3: Generate SRT file - use word timings if available for precise sync
        const srtPath = path.join(tempDir, 'captions.srt');
        let srtContent: string;
        if (wordTimings && wordTimings.length > 0) {
            console.log(`📝 Generating SRT from ${wordTimings.length} word timings (${wordsPerCaption} words per caption)`);
            srtContent = generateSRTFromWordTimings(wordTimings, wordsPerCaption);
        } else {
            console.log('📝 Generating SRT from script lines (estimated timing)');
            srtContent = generateSRT(scriptLines);
        }
        fs.writeFileSync(srtPath, srtContent, 'utf8');

        // Step 4: Build FFmpeg command
        const args: string[] = [];

        // Input files
        args.push('-i', loopedVideoPath);
        args.push('-i', voiceoverPath);
        if (musicPath) {
            args.push('-i', musicPath);
        }

        // Build filter complex
        let filterComplex = '';
        let audioMix = '';

        // Video filters with captions
        const fontFile = getFontPath(captionSettings.font);
        const escapedSrtPath = srtPath.replace(/'/g, "'\\''").replace(/:/g, '\\:');

        // Caption style - using drawtext for more control
        const captionFilter = buildCaptionFilter(captionSettings, escapedSrtPath);
        filterComplex += `[0:v]${captionFilter}[v]`;

        // Audio mixing
        if (musicPath) {
            // Mix voiceover with music (music at lower volume)
            filterComplex += `;[1:a]volume=${voiceoverVolume}[voice];[2:a]volume=${musicVolume}[music];[voice][music]amix=inputs=2:duration=first[a]`;
            audioMix = '[a]';
        } else {
            // Just voiceover with volume adjustment
            filterComplex += `;[1:a]volume=${voiceoverVolume}[a]`;
            audioMix = '[a]';
        }

        args.push('-filter_complex', filterComplex);
        args.push('-map', '[v]');
        args.push('-map', audioMix);

        // Output settings
        args.push('-c:v', 'libx264');
        args.push('-preset', 'medium');
        args.push('-crf', '20');
        args.push('-c:a', 'aac');
        args.push('-b:a', '192k');
        args.push('-t', targetDuration.toString());
        args.push('-y');
        args.push(outputPath);

        console.log(`🎬 Compositing video: ffmpeg ${args.slice(0, 10).join(' ')}...`);

        // Execute FFmpeg
        await runFFmpeg(args);

        // Get final duration
        const finalDuration = await getVideoDuration(outputPath);

        console.log(`✅ Video composition complete: ${outputPath}`);

        return {
            outputPath,
            duration: finalDuration,
            success: true,
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Video composition failed:', errorMessage);

        return {
            outputPath: '',
            duration: 0,
            success: false,
            error: errorMessage,
        };
    } finally {
        // Cleanup temp files except the output
        try {
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                if (filePath !== outputPath) {
                    fs.unlinkSync(filePath);
                }
            }
            // Only remove temp dir if output is not in it
            if (customOutputPath) {
                fs.rmdirSync(tempDir);
            }
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * Build caption filter string for FFmpeg
 * Optimized for 9:16 portrait short-form videos (Reels/Shorts/TikTok)
 *
 * Target: Clean, centered captions like viral TikTok/Reels videos
 * - Text centered both horizontally and vertically on screen
 * - Strong outline for visibility on any background
 *
 * Positioning strategy:
 * - Always use Alignment=2 (bottom-center anchor) for consistent text centering
 * - Control vertical position with MarginV (distance from bottom)
 * - For 1920px height: top ~1700, center ~850, bottom ~100
 */
function buildCaptionFilter(settings: CaptionSettings, srtPath: string): string {
    const {
        font,
        fontSize,
        fontColor,
        strokeColor,
        strokeWidth,
        position,
    } = settings;

    // Scale font size for ASS subtitles on 1080x1920 video
    // UI default is 40, target ~18-24px in ASS terms
    const scaledFontSize = Math.min(28, Math.max(14, Math.floor(fontSize * 0.5)));

    // Always use alignment 2 (bottom-center) - text will be horizontally centered
    // Then use MarginV to push it up from the bottom to desired position
    // For 1920px video: top needs ~1700 MarginV, center ~850, bottom ~100
    const alignment = 2;
    let marginV = 100; // Default bottom

    switch (position) {
        case 'top':
            marginV = 1700; // Push up from bottom to top area
            break;
        case 'center':
            marginV = 850;  // Push up to center
            break;
        case 'bottom':
            marginV = 100;  // Small margin from bottom
            break;
    }

    // Map fonts
    const fontMap: Record<string, string> = {
        'Montserrat': 'Arial',
        'Arial': 'Arial',
        'Impact': 'Impact',
        'Helvetica': 'Helvetica',
        'Roboto': 'Arial',
    };
    const systemFont = fontMap[font] || 'Arial';

    // Calculate outline - proportional to font size
    const scaledOutline = Math.max(1, Math.min(3, Math.ceil(scaledFontSize * 0.08)));

    // Build ASS style string with explicit centering
    const styleParams = [
        `Fontname=${systemFont}`,
        `Fontsize=10`,
        `PrimaryColour=${hexToAss(fontColor)}`,
        `OutlineColour=${hexToAss(strokeColor)}`,
        `BackColour=&H40000000`,
        `Bold=1`,
        `Outline=${scaledOutline}`,
        `Shadow=0`,
        `Alignment=2`,
        `MarginL=0`,
        `MarginR=0`,
        `MarginV=1`,
    ].join(',');

    // Use subtitles filter with original_size to ensure proper scaling
    return `subtitles='${srtPath}':force_style='${styleParams}'`;
}

/**
 * Convert hex color to ASS format (&HAABBGGRR)
 */
function hexToAss(hex: string): string {
    // Remove # if present
    const clean = hex.replace('#', '');

    // Parse RGB
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);

    // ASS uses BGR format with &H prefix
    return `&H00${b.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}`.toUpperCase();
}

/**
 * Get font file path for FFmpeg
 */
function getFontPath(fontName: string): string {
    // Common font paths
    const fontPaths: Record<string, string> = {
        'Montserrat': '/System/Library/Fonts/Supplemental/Arial.ttf',
        'Arial': '/System/Library/Fonts/Supplemental/Arial.ttf',
        'Helvetica': '/System/Library/Fonts/Helvetica.ttc',
        'Impact': '/System/Library/Fonts/Supplemental/Impact.ttf',
        'default': '/System/Library/Fonts/Helvetica.ttc',
    };

    return fontPaths[fontName] || fontPaths['default'];
}

/**
 * Run FFmpeg command
 */
function runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const ffmpegProcess = spawn('ffmpeg', args);
        let stderr = '';

        ffmpegProcess.stderr?.on('data', (data) => {
            stderr += data.toString();
            // Log progress
            const progress = stderr.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
            if (progress) {
                process.stdout.write(`\r   Progress: ${progress[1]}`);
            }
        });

        ffmpegProcess.on('close', (code) => {
            console.log(''); // New line after progress
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
            }
        });

        ffmpegProcess.on('error', reject);
    });
}

/**
 * Composite video and upload to S3
 */
export async function compositeAndUpload(
    input: CompositionInput,
    projectId: string
): Promise<CompositionResult> {
    // Generate locally first
    const result = await compositeVideo(input);

    if (!result.success) {
        return result;
    }

    try {
        // Upload to S3
        const s3Key = `viral-videos/${projectId}/${Date.now()}.mp4`;
        const uploadResult = await uploadToS3(result.outputPath, s3Key, 'video/mp4');

        return {
            ...result,
            s3Key,
            s3Url: uploadResult.url,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            ...result,
            error: `Video created but S3 upload failed: ${errorMessage}`,
        };
    }
}

/**
 * Simple video merge without captions (for quick preview)
 */
export async function mergeAudioVideo(
    videoPath: string,
    audioPath: string,
    outputPath: string,
    options?: {
        musicPath?: string;
        musicVolume?: number;
    }
): Promise<void> {
    const args: string[] = [];

    // Get audio duration to know how long to make the video
    const audioDuration = await getAudioDuration(audioPath);

    // Input files
    args.push('-stream_loop', '-1');
    args.push('-i', videoPath);
    args.push('-i', audioPath);

    if (options?.musicPath) {
        args.push('-i', options.musicPath);
        const musicVol = options.musicVolume ?? 0.2;
        args.push('-filter_complex', `[1:a]volume=1.0[voice];[2:a]volume=${musicVol}[music];[voice][music]amix=inputs=2:duration=first[a]`);
        args.push('-map', '0:v');
        args.push('-map', '[a]');
    } else {
        args.push('-map', '0:v');
        args.push('-map', '1:a');
    }

    args.push('-c:v', 'libx264');
    args.push('-preset', 'fast');
    args.push('-crf', '23');
    args.push('-c:a', 'aac');
    args.push('-b:a', '192k');
    args.push('-t', audioDuration.toString());
    args.push('-shortest');
    args.push('-y');
    args.push(outputPath);

    await runFFmpeg(args);
}

/**
 * Add watermark to video
 */
export async function addWatermark(
    inputPath: string,
    outputPath: string,
    watermarkText: string,
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-right'
): Promise<void> {
    const positionMap = {
        'top-left': 'x=20:y=20',
        'top-right': 'x=w-tw-20:y=20',
        'bottom-left': 'x=20:y=h-th-20',
        'bottom-right': 'x=w-tw-20:y=h-th-20',
    };

    const args = [
        '-i', inputPath,
        '-vf', `drawtext=text='${watermarkText}':fontsize=24:fontcolor=white@0.7:${positionMap[position]}`,
        '-c:a', 'copy',
        '-y',
        outputPath
    ];

    await runFFmpeg(args);
}
