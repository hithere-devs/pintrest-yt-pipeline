import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'video-pipeline-assets';

// Initialize with service account credentials
const storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    keyFilename: './gcp-servicekey.json',
});

const bucket = storage.bucket(BUCKET_NAME);

// Videos to upload (the processed ones without audio)
const videosToUpload = [
    {
        localPath: '/Users/azhar/Development/video-pipeline/processed/minecraft-parkour-no-audio.mp4',
        gcsKey: 'assets/videos/minecraft-parkour.mp4',
        name: 'Minecraft Parkour',
        tags: ['minecraft', 'parkour', 'gaming', 'satisfying'],
    },
    {
        localPath: '/Users/azhar/Development/video-pipeline/processed/apples-world-no-audio.mp4',
        gcsKey: 'assets/videos/apples-world.mp4',
        name: 'Apples World',
        tags: ['apples', 'fruit', 'satisfying', 'food'],
    },
    {
        localPath: '/Users/azhar/Development/video-pipeline/processed/pinterest-pin-no-audio.mp4',
        gcsKey: 'assets/videos/pinterest-pin.mp4',
        name: 'Pinterest Pin',
        tags: ['pinterest', 'viral', 'trending'],
    },
    {
        localPath: '/Users/azhar/Development/video-pipeline/processed/dolomites-ridge-no-audio.mp4',
        gcsKey: 'assets/videos/dolomites-ridge.mp4',
        name: 'Dolomites Ridge',
        tags: ['mountains', 'extreme', 'nature', 'adventure'],
    },
];

async function uploadVideo(video: typeof videosToUpload[0]) {
    console.log(`\n📤 Uploading: ${video.name}`);
    console.log(`   From: ${video.localPath}`);
    console.log(`   To: gs://${BUCKET_NAME}/${video.gcsKey}`);

    if (!fs.existsSync(video.localPath)) {
        console.error(`   ❌ File not found: ${video.localPath}`);
        return null;
    }

    try {
        await bucket.upload(video.localPath, {
            destination: video.gcsKey,
            metadata: {
                contentType: 'video/mp4',
                cacheControl: 'public, max-age=31536000',
                metadata: {
                    name: video.name,
                    tags: video.tags.join(','),
                    uploadedAt: new Date().toISOString(),
                },
            },
        });

        // Make the file publicly accessible
        await bucket.file(video.gcsKey).makePublic();

        const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${video.gcsKey}`;
        console.log(`   ✅ Uploaded successfully!`);
        console.log(`   🔗 URL: ${publicUrl}`);

        return {
            name: video.name,
            gcsKey: video.gcsKey,
            url: publicUrl,
            tags: video.tags,
        };
    } catch (error) {
        console.error(`   ❌ Upload failed:`, error);
        return null;
    }
}

async function main() {
    console.log('🚀 Starting video upload to Google Cloud Storage');
    console.log(`📦 Bucket: ${BUCKET_NAME}`);
    console.log(`📁 Project: ${process.env.GCS_PROJECT_ID}`);

    // Check if bucket exists
    try {
        const [exists] = await bucket.exists();
        if (!exists) {
            console.log('\n📦 Creating bucket...');
            await storage.createBucket(BUCKET_NAME, {
                location: 'US',
                storageClass: 'STANDARD',
            });
            console.log('   ✅ Bucket created!');
        }
    } catch (error: any) {
        if (error.code !== 409) { // 409 = bucket already exists
            console.error('❌ Error checking/creating bucket:', error.message);
        }
    }

    const results: any[] = [];

    for (const video of videosToUpload) {
        const result = await uploadVideo(video);
        if (result) {
            results.push(result);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Upload Summary');
    console.log('='.repeat(60));
    console.log(`✅ Uploaded: ${results.length}/${videosToUpload.length} videos`);

    if (results.length > 0) {
        console.log('\n📋 Uploaded Videos:');
        results.forEach((r, i) => {
            console.log(`\n${i + 1}. ${r.name}`);
            console.log(`   URL: ${r.url}`);
            console.log(`   Tags: ${r.tags.join(', ')}`);
        });

        // Output SQL to insert into AssetLibrary
        console.log('\n' + '='.repeat(60));
        console.log('📝 SQL to insert into AssetLibrary:');
        console.log('='.repeat(60));
        results.forEach((r) => {
            console.log(`
INSERT INTO "AssetLibrary" ("type", "name", "s3Key", "s3Url", "tags", "isActive")
VALUES ('video', '${r.name}', '${r.gcsKey}', '${r.url}', ARRAY[${r.tags.map((t: string) => `'${t}'`).join(', ')}], true);
`);
        });
    }
}

main().catch(console.error);
