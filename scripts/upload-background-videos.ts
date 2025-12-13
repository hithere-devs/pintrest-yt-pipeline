import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { uploadToGCS } from '../src/gcsClient';
import { createAsset } from '../src/db/viralVideo';
import { initializeDatabase } from '../src/pgClient';

interface VideoInfo {
    originalPath: string;
    name: string;
    outputPath: string;
}

// Videos to process
const videos: VideoInfo[] = [
    {
        originalPath: '/Users/azhar/Development/video-pipeline/From KlickPin CF 🍎🍏 Crunch into Deliciousness Exploring the World of Apples! 🍎🍏 [Video] in 2025 _ Funny vegetables Satisfying video Fruit world.mp4',
        name: 'Apples World - Satisfying Video',
        outputPath: '/Users/azhar/Development/video-pipeline/processed/apples-world-no-audio.mp4'
    },
    {
        originalPath: '/Users/azhar/Development/video-pipeline/From KlickPin CF [Видео] «Touching the void on the most breathtaking ridge of the Dolomites😱» _ Экстремальный вид спорта Экстремальные виды спорта Туризм.mp4',
        name: 'Dolomites Ridge - Extreme Sports',
        outputPath: '/Users/azhar/Development/video-pipeline/processed/dolomites-ridge-no-audio.mp4'
    },
    {
        originalPath: '/Users/azhar/Development/video-pipeline/From KlickPin CF Pinterest Pin-619667230019811233.mp4',
        name: 'Pinterest Pin Background Video',
        outputPath: '/Users/azhar/Development/video-pipeline/processed/pinterest-pin-no-audio.mp4'
    },
    {
        originalPath: '/Users/azhar/Development/video-pipeline/From KlickPin CF Your checkpoint of chill minecraft parkour [Video] _ Parkour Green screen video backgrounds Minecraft images.mp4',
        name: 'Minecraft Parkour - Chill Background',
        outputPath: '/Users/azhar/Development/video-pipeline/processed/minecraft-parkour-no-audio.mp4'
    }
];

async function getVideoDuration(filePath: string): Promise<number> {
    try {
        const output = execSync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
            { encoding: 'utf-8' }
        );
        return parseFloat(output.trim());
    } catch (error) {
        console.error('Error getting video duration:', error);
        return 0;
    }
}

async function removeAudio(inputPath: string, outputPath: string): Promise<void> {
    console.log(`  Removing audio from: ${path.basename(inputPath)}`);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        // Remove audio stream and copy video stream without re-encoding
        execSync(
            `ffmpeg -i "${inputPath}" -an -c:v copy "${outputPath}" -y`,
            { stdio: 'inherit' }
        );
        console.log(`  ✓ Audio removed successfully`);
    } catch (error) {
        console.error('  ✗ Error removing audio:', error);
        throw error;
    }
}

async function uploadVideoToS3AndDB(videoInfo: VideoInfo): Promise<void> {
    console.log(`\n📹 Processing: ${videoInfo.name}`);

    // Step 1: Remove audio
    await removeAudio(videoInfo.originalPath, videoInfo.outputPath);

    // Step 2: Get video duration
    const duration = await getVideoDuration(videoInfo.outputPath);
    console.log(`  Duration: ${duration.toFixed(2)}s`);

    // Step 3: Upload to GCS
    const filename = path.basename(videoInfo.outputPath);
    const s3Key = `background-videos/${Date.now()}-${filename}`;

    console.log(`  Uploading to GCS...`);
    const uploadResult = await uploadToGCS(videoInfo.outputPath, s3Key, 'video/mp4');
    console.log(`  ✓ Uploaded to GCS: ${uploadResult.url}`);

    // Step 4: Save to database
    console.log(`  Saving to database...`);
    const asset = await createAsset({
        type: 'video',
        name: videoInfo.name,
        description: `Background video without audio - processed from Pinterest download`,
        s3Key: uploadResult.key,
        s3Url: uploadResult.url,
        duration: Math.round(duration),
        metadata: {
            originalFileName: path.basename(videoInfo.originalPath),
            processedAt: new Date().toISOString(),
            audioRemoved: true,
        },
        tags: ['background', 'no-audio', 'pinterest'],
    });

    console.log(`  ✓ Saved to database with ID: ${asset.id}`);

    // Step 5: Clean up processed file
    try {
        fs.unlinkSync(videoInfo.outputPath);
        console.log(`  ✓ Cleaned up temporary file`);
    } catch (error) {
        console.warn(`  ⚠ Could not clean up temporary file:`, error);
    }
}

async function main() {
    console.log('🚀 Starting background video upload process...\n');

    // Initialize database
    await initializeDatabase();
    console.log('✓ Database initialized\n');

    // Check GCS configuration
    const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || './gcp-credentials.json';
    if (!fs.existsSync(keyFile)) {
        console.error('❌ GCP credentials file not found!');
        console.error(`Expected: ${keyFile}`);
        console.error('Please ensure gcp-credentials.json exists in the project root');
        process.exit(1);
    }

    if (!process.env.GCS_BUCKET_NAME) {
        console.error('❌ GCS_BUCKET_NAME not found in environment variables!');
        console.error('Please set GCS_BUCKET_NAME in your .env file');
        process.exit(1);
    }

    console.log(`✓ GCS Bucket: ${process.env.GCS_BUCKET_NAME}`);
    console.log(`✓ GCP Project: ${process.env.GCS_PROJECT_ID || 'gen-lang-client-0040772112'}`);
    console.log(`✓ Credentials: ${keyFile}\n`);

    // Process all videos
    let successCount = 0;
    let failCount = 0;

    for (const video of videos) {
        try {
            await uploadVideoToS3AndDB(video);
            successCount++;
        } catch (error) {
            console.error(`\n❌ Failed to process ${video.name}:`, error);
            failCount++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Process complete!`);
    console.log(`   Success: ${successCount}/${videos.length}`);
    console.log(`   Failed: ${failCount}/${videos.length}`);
    console.log('='.repeat(60));

    process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
