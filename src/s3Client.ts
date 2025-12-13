import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'video-pipeline-frames';
const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL; // Optional: for CDN URLs

export interface UploadResult {
    key: string;
    url: string;
    bucket: string;
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(
    filePath: string,
    key: string,
    contentType?: string
): Promise<UploadResult> {
    const fileContent = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Determine content type
    const mimeType = contentType || getMimeType(ext);

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: mimeType,
    });

    await s3Client.send(command);

    // Generate URL
    const url = CLOUDFRONT_URL
        ? `${CLOUDFRONT_URL}/${key}`
        : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

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
): Promise<Array<{ index: number; timestamp: number; s3Url: string; key: string }>> {
    const results: Array<{ index: number; timestamp: number; s3Url: string; key: string }> = [];

    for (const frame of frames) {
        const ext = path.extname(frame.filePath);
        const key = `frames/${videoId}/frame_${frame.index}${ext}`;

        try {
            const result = await uploadToS3(frame.filePath, key);
            results.push({
                index: frame.index,
                timestamp: frame.timestamp,
                s3Url: result.url,
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
 * Delete frames from S3
 */
export async function deleteFramesFromS3(videoId: string, frameKeys: string[]): Promise<void> {
    for (const key of frameKeys) {
        try {
            const command = new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            });
            await s3Client.send(command);
        } catch (error) {
            console.error(`Failed to delete frame ${key}:`, error);
        }
    }
}

/**
 * Generate a presigned URL for temporary access
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Check if S3 is configured
 */
export function isS3Configured(): boolean {
    return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME);
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
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

export { s3Client, BUCKET_NAME };
