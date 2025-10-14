import { createWriteStream } from 'fs';
import { mkdir, rm } from 'fs/promises';
import path from 'path';
import { finished } from 'stream/promises';
import axios from 'axios';

const DOWNLOAD_DIR = path.resolve('downloads');

function buildFilename(baseUrl: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const parsed = new URL(baseUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const lastSegment = segments.at(-1) ?? 'pinterest-video';
    const sanitized = lastSegment.replace(/[^a-zA-Z0-9-_]/g, '_');
    const ext = path.extname(lastSegment) || '.mp4';
    return `${timestamp}_${sanitized}${ext}`;
}

export async function ensureDownloadDir(): Promise<string> {
    await mkdir(DOWNLOAD_DIR, { recursive: true });
    return DOWNLOAD_DIR;
}

export async function downloadVideo(videoUrl: string): Promise<string> {
    await ensureDownloadDir();
    const filename = buildFilename(videoUrl);
    const filePath = path.join(DOWNLOAD_DIR, filename);

    const response = await axios.get<unknown>(videoUrl, { responseType: 'stream' });

    const writer = createWriteStream(filePath);
    (response.data as NodeJS.ReadableStream).pipe(writer);

    try {
        await finished(writer);
    } catch (error) {
        await rm(filePath, { force: true });
        throw error;
    }

    return filePath;
}
