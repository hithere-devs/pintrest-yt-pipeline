import { spawn } from 'child_process';
import path from 'path';

const PYTHON_BIN = path.resolve('.venv/bin/python');
const DOWNLOADER_SCRIPT = path.resolve('scripts/pinterest_downloader.py');
const DOWNLOAD_DIR = path.resolve('downloads');

export interface PinterestMetadata {
    title?: string;
    description?: string;
    keywords?: string[];
}

interface DownloadResult {
    success: boolean;
    filePath?: string;
    metadata?: PinterestMetadata;
    error?: string;
}

export interface DownloadResponse {
    filePath: string;
    metadata: PinterestMetadata;
}

/**
 * Downloads a Pinterest video using the Python downloader script.
 * Returns the file path and extracted Pinterest metadata.
 */
export async function downloadPinterestMedia(url: string): Promise<DownloadResponse> {
    return new Promise((resolve, reject) => {
        const args = [DOWNLOADER_SCRIPT, url, DOWNLOAD_DIR];

        const proc = spawn(PYTHON_BIN, args);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Pinterest downloader failed (exit ${code}): ${stderr || stdout}`));
                return;
            }

            try {
                const result: DownloadResult = JSON.parse(stdout.trim());

                if (result.success && result.filePath) {
                    resolve({
                        filePath: result.filePath,
                        metadata: result.metadata || {}
                    });
                } else {
                    reject(new Error(result.error || 'Unknown error'));
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                reject(new Error(`Failed to parse downloader output: ${message}\nOutput: ${stdout}`));
            }
        });

        proc.on('error', (error) => {
            reject(new Error(`Failed to spawn downloader: ${error.message}`));
        });
    });
}
