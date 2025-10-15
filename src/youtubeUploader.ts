import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { generateVideoMetadata } from './aiContentGenerator';

const CONFIG_PATH = path.join(__dirname, '..', 'youtube-config.json');
const TOKENS_PATH = path.join(__dirname, '..', 'youtube-tokens.json');

// YouTube API scopes
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

interface YouTubeConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

interface YouTubeTokens {
    access_token: string;
    refresh_token?: string;
    scope: string;
    token_type: string;
    expiry_date: number;
}

interface VideoMetadata {
    title: string;
    description: string;
    tags?: string[];
    categoryId?: string;
    privacyStatus?: 'public' | 'private' | 'unlisted';
}

/**
 * Load YouTube OAuth2 configuration
 */
function loadConfig(): YouTubeConfig {
    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error(
            'YouTube config not found. Copy youtube-config.example.json to youtube-config.json and add your credentials.'
        );
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

/**
 * Create OAuth2 client
 */
export function createOAuth2Client(): OAuth2Client {
    const config = loadConfig();
    const oauth2Client = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri
    );

    // Load saved tokens if available
    if (fs.existsSync(TOKENS_PATH)) {
        const tokens: YouTubeTokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
        oauth2Client.setCredentials(tokens);
    }

    return oauth2Client;
}

/**
 * Generate authorization URL for user consent
 */
export function getAuthUrl(): string {
    const oauth2Client = createOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent', // Force consent screen to get refresh token
    });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code: string): Promise<void> {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save tokens for future use
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
    console.log('YouTube tokens saved successfully');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
    return fs.existsSync(TOKENS_PATH);
}

/**
 * Upload video to YouTube
 */
export async function uploadVideo(
    filePath: string,
    metadata: VideoMetadata
): Promise<string> {
    if (!isAuthenticated()) {
        throw new Error('Not authenticated. Please complete OAuth2 flow first.');
    }

    const oauth2Client = createOAuth2Client();
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const fileSize = fs.statSync(filePath).size;
    console.log(`Uploading video: ${path.basename(filePath)} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

    try {
        const response = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
                snippet: {
                    title: metadata.title,
                    description: metadata.description,
                    tags: metadata.tags || [],
                    categoryId: metadata.categoryId || '22', // Default: People & Blogs
                    defaultLanguage: 'en',
                },
                status: {
                    privacyStatus: metadata.privacyStatus || 'private',
                    selfDeclaredMadeForKids: false,
                },
            },
            media: {
                body: fs.createReadStream(filePath),
            },
        });

        const videoId = response.data.id;
        if (!videoId) {
            throw new Error('Video upload succeeded but no video ID returned');
        }

        console.log(`Video uploaded successfully! Video ID: ${videoId}`);
        console.log(`Watch at: https://www.youtube.com/watch?v=${videoId}`);

        return videoId;
    } catch (error: any) {
        if (error.code === 401) {
            throw new Error('Authentication expired. Please re-authenticate.');
        }
        throw new Error(`YouTube upload failed: ${error.message}`);
    }
}

/**
 * Generate video metadata from Pinterest URL using AI
 */
export async function generateMetadata(
    pinterestUrl: string,
    pinterestMetadata?: import('./pinterestDL').PinterestMetadata,
    filePath?: string
): Promise<VideoMetadata> {
    // Use AI to generate engaging title and description
    // Pass Pinterest metadata to AI for better context
    const aiMetadata = await generateVideoMetadata(pinterestUrl, pinterestMetadata, filePath);

    return {
        title: aiMetadata.title,
        description: aiMetadata.description,
        tags: aiMetadata.tags,
        categoryId: '22', // People & Blogs
        privacyStatus: 'private', // Start private, user can make public later
    };
}
