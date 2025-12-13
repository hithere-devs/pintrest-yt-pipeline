import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { generateVideoMetadata } from './aiContentGenerator';
import { getUserTokens } from './db';

const CONFIG_PATH = path.join(__dirname, '..', 'youtube-config.json');
const TOKENS_PATH = path.join(__dirname, '..', 'youtube-tokens.json');

// YouTube API scopes
const SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'openid',
    'email',
    'profile'
];

interface YouTubeConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

export interface YouTubeTokens {
    access_token: string;
    refresh_token?: string;
    scope: string;
    token_type: string;
    expiry_date: number;
    id_token?: string;
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
export function createOAuth2Client(tokens?: YouTubeTokens): OAuth2Client {
    const config = loadConfig();
    const oauth2Client = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri
    );

    // Load saved tokens if available (legacy file support)
    if (tokens) {
        oauth2Client.setCredentials(tokens);
    } else if (fs.existsSync(TOKENS_PATH)) {
        const fileTokens: YouTubeTokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
        oauth2Client.setCredentials(fileTokens);
    }

    return oauth2Client;
}

/**
 * Generate authorization URL for user consent
 */
export function getAuthUrl(state?: string): string {
    const oauth2Client = createOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent', // Force consent screen to get refresh token
        state,
    });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code: string): Promise<YouTubeTokens> {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens as YouTubeTokens;
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
    metadata: VideoMetadata,
    userId?: string
): Promise<{ videoId: string; thumbnailUrl?: string }> {
    let oauth2Client: OAuth2Client;

    if (userId) {
        const tokens = await getUserTokens(userId);
        if (!tokens || !tokens.accessToken) {
            throw new Error(`No tokens found for user ${userId}`);
        }
        // Map DB tokens to YouTubeTokens interface
        const ytTokens: YouTubeTokens = {
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            scope: SCOPES.join(' '),
            token_type: 'Bearer',
            expiry_date: tokens.tokenExpiry ? new Date(tokens.tokenExpiry).getTime() : 0
        };
        oauth2Client = createOAuth2Client(ytTokens);
    } else {
        if (!isAuthenticated()) {
            throw new Error('Not authenticated. Please complete OAuth2 flow first.');
        }
        oauth2Client = createOAuth2Client();
    }

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
                    privacyStatus: 'public',
                    selfDeclaredMadeForKids: false,
                },
            },
            media: {
                body: fs.createReadStream(filePath),
            },
        });

        const videoId = response.data.id;
        const thumbnailUrl = response.data.snippet?.thumbnails?.high?.url || response.data.snippet?.thumbnails?.default?.url;

        if (!videoId) {
            throw new Error('Video upload succeeded but no video ID returned');
        }

        console.log(`Video uploaded successfully! Video ID: ${videoId}`);
        console.log(`Watch at: https://www.youtube.com/watch?v=${videoId}`);

        return { videoId, thumbnailUrl: thumbnailUrl || undefined };
    } catch (error: any) {
        if (error.code === 401) {
            throw new Error('Authentication expired. Please re-authenticate.');
        }
        throw new Error(`YouTube upload failed: ${error.message}`);
    }
}


/**
 * Update video details on YouTube
 */
export async function updateVideoDetails(
    videoId: string,
    metadata: Partial<VideoMetadata>,
    userId?: string
): Promise<void> {
    let oauth2Client: OAuth2Client;

    if (userId) {
        const tokens = await getUserTokens(userId);
        if (!tokens || !tokens.accessToken) {
            throw new Error(`No tokens found for user ${userId}`);
        }
        const ytTokens: YouTubeTokens = {
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            scope: SCOPES.join(' '),
            token_type: 'Bearer',
            expiry_date: tokens.tokenExpiry ? new Date(tokens.tokenExpiry).getTime() : 0
        };
        oauth2Client = createOAuth2Client(ytTokens);
    } else {
        if (!isAuthenticated()) {
            throw new Error('Not authenticated. Please complete OAuth2 flow first.');
        }
        oauth2Client = createOAuth2Client();
    }

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    try {
        // First get the snippet to preserve other fields
        const videoResponse = await youtube.videos.list({
            part: ['snippet'],
            id: [videoId],
        });

        const video = videoResponse.data.items?.[0];
        if (!video || !video.snippet) {
            throw new Error('Video not found');
        }

        await youtube.videos.update({
            part: ['snippet'],
            requestBody: {
                id: videoId,
                snippet: {
                    ...video.snippet,
                    title: metadata.title || video.snippet.title,
                    description: metadata.description || video.snippet.description,
                    tags: metadata.tags || video.snippet.tags,
                    categoryId: metadata.categoryId || video.snippet.categoryId,
                },
            },
        });

        console.log(`Video updated successfully! Video ID: ${videoId}`);
    } catch (error: any) {
        if (error.code === 401) {
            throw new Error('Authentication expired. Please re-authenticate.');
        }
        throw new Error(`YouTube update failed: ${error.message}`);
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

/**
 * Verify Google ID Token
 */
export async function verifyIdToken(idToken: string) {
    const client = createOAuth2Client();
    const ticket = await client.verifyIdToken({
        idToken,
        audience: loadConfig().clientId,
    });
    return ticket.getPayload();
}

/**
 * Get authenticated user's YouTube Channel ID
 */
export async function getChannelId(tokens: YouTubeTokens): Promise<string> {
    const auth = createOAuth2Client(tokens);
    const youtube = google.youtube({ version: 'v3', auth });

    const response = await youtube.channels.list({
        part: ['id'],
        mine: true
    });

    if (!response.data.items || response.data.items.length === 0) {
        throw new Error('No YouTube channel found for this user');
    }

    return response.data.items[0].id!;
}
