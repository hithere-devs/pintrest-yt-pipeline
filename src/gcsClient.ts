import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Initialize GCS client
// Option 1: Use GOOGLE_APPLICATION_CREDENTIALS env var pointing to service account JSON
// Option 2: Use explicit credentials from env vars
// Option 3: Use default credentials (gcloud auth)
const storageOptions: ConstructorParameters<typeof Storage>[0] = {
    projectId: process.env.GCS_PROJECT_ID || 'gen-lang-client-0040772112',
};

// Only set keyFilename if it's a service account file (not OAuth)
const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (keyFile && fs.existsSync(keyFile)) {
    try {
        const keyContent = JSON.parse(fs.readFileSync(keyFile, 'utf-8'));
        // Check if it's a service account key (has private_key field)
        if (keyContent.private_key && keyContent.client_email) {
            storageOptions.keyFilename = keyFile;
        }
    } catch (error) {
        console.warn('Could not read GCP credentials file, using default credentials');
    }
}

// If explicit credentials are provided via env vars
if (process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY) {
    storageOptions.credentials = {
        client_email: process.env.GCS_CLIENT_EMAIL,
        private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle escaped newlines
    };
}

const storage = new Storage(storageOptions);
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'video-pipeline-assets';
const bucket = storage.bucket(BUCKET_NAME);

// Optional CDN URL (Cloud CDN or custom domain)
const CDN_URL = process.env.GCS_CDN_URL;

export interface UploadResult {
    key: string;
    url: string;
    bucket: string;
}

/**
 * Upload a file to Google Cloud Storage
 */
export async function uploadToGCS(
    filePath: string,
    key: string,
    contentType?: string
): Promise<UploadResult> {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = contentType || getMimeType(ext);

    await bucket.upload(filePath, {
        destination: key,
        metadata: {
            contentType: mimeType,
            cacheControl: 'public, max-age=31536000', // 1 year cache
        },
    });

    // Make the file publicly readable
    const file = bucket.file(key);
    await file.makePublic();

    // Generate public URL
    const url = CDN_URL
        ? `${CDN_URL}/${key}`
        : `https://storage.googleapis.com/${BUCKET_NAME}/${key}`;

    return {
        key,
        url,
        bucket: BUCKET_NAME,
    };
}

/**
 * Upload a buffer directly to GCS
 */
export async function uploadBufferToGCS(
    buffer: Buffer,
    key: string,
    contentType: string
): Promise<UploadResult> {
    const file = bucket.file(key);

    await file.save(buffer, {
        metadata: {
            contentType,
            cacheControl: 'public, max-age=31536000',
        },
    });

    // Make the file publicly readable
    await file.makePublic();

    const url = CDN_URL
        ? `${CDN_URL}/${key}`
        : `https://storage.googleapis.com/${BUCKET_NAME}/${key}`;

    return {
        key,
        url,
        bucket: BUCKET_NAME,
    };
}

/**
 * Upload frame images for a video
 */
export async function uploadFrames(
    videoId: string,
    frames: Array<{ filePath: string; index: number; timestamp: number }>
): Promise<Array<{ index: number; timestamp: number; gcsUrl: string; key: string }>> {
    const results: Array<{ index: number; timestamp: number; gcsUrl: string; key: string }> = [];

    for (const frame of frames) {
        const ext = path.extname(frame.filePath);
        const key = `frames/${videoId}/frame_${frame.index}${ext}`;

        try {
            const result = await uploadToGCS(frame.filePath, key);
            results.push({
                index: frame.index,
                timestamp: frame.timestamp,
                gcsUrl: result.url,
                key: result.key,
            });
        } catch (error) {
            console.error(`Failed to upload frame ${frame.index}:`, error);
            throw error;
        }
    }

    return results;
}

/**
 * Delete a file from GCS
 */
export async function deleteFromGCS(key: string): Promise<void> {
    try {
        await bucket.file(key).delete();
    } catch (error) {
        console.error(`Failed to delete ${key}:`, error);
    }
}

/**
 * Delete frames from GCS
 */
export async function deleteFramesFromGCS(videoId: string, frameKeys: string[]): Promise<void> {
    for (const key of frameKeys) {
        await deleteFromGCS(key);
    }
}

/**
 * Generate a signed URL for temporary access
 */
export async function getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const [url] = await bucket.file(key).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
    });
    return url;
}

/**
 * Check if a file exists in GCS
 */
export async function fileExists(key: string): Promise<boolean> {
    const [exists] = await bucket.file(key).exists();
    return exists;
}

/**
 * Download a file from GCS to local path
 */
export async function downloadFromGCS(key: string, localPath: string): Promise<void> {
    await bucket.file(key).download({ destination: localPath });
}

/**
 * Get file metadata
 */
export async function getFileMetadata(key: string): Promise<{ size: number; contentType: string; updated: string } | null> {
    try {
        const [metadata] = await bucket.file(key).getMetadata();
        return {
            size: parseInt(metadata.size as string, 10),
            contentType: metadata.contentType as string,
            updated: metadata.updated as string,
        };
    } catch {
        return null;
    }
}

/**
 * Check if GCS is configured
 */
export function isGCSConfigured(): boolean {
    const hasEnvCredentials = !!(process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY);
    const hasFileCredentials = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return !!(process.env.GCS_BUCKET_NAME && (hasEnvCredentials || hasFileCredentials));
}

/**
 * Get MIME type from file extension
 */
function getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.srt': 'text/plain',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

// Re-export with S3-compatible names for easier migration
export {
    uploadToGCS as uploadToS3,
    deleteFromGCS as deleteFromS3,
    getSignedUrl as getPresignedUrl,
    isGCSConfigured as isS3Configured,
};

export { storage, bucket, BUCKET_NAME };
