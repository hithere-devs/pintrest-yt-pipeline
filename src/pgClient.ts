import { Pool, PoolClient } from 'pg';
import 'dotenv/config';

// Parse the DATABASE_URL or use individual env vars
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false, // SSL disabled for local PostgreSQL
});

// Test connection on startup
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

export { pool };

// Helper function to get a client from the pool
export async function getClient(): Promise<PoolClient> {
    return pool.connect();
}

// Helper function to run a query
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const result = await pool.query(text, params);
    return result.rows;
}

// Helper function to run a single query and return first result
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const result = await pool.query(text, params);
    return result.rows[0] || null;
}

// Initialize the database schema
export async function initializeDatabase(): Promise<void> {
    const client = await pool.connect();
    try {
        // Enable UUID extension
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        // Create User table
        await client.query(`
            CREATE TABLE IF NOT EXISTS "User" (
                "id" TEXT PRIMARY KEY,
                "email" TEXT,
                "accessToken" TEXT,
                "refreshToken" TEXT,
                "tokenExpiry" TIMESTAMP WITH TIME ZONE,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // Create Video table
        await client.query(`
            CREATE TABLE IF NOT EXISTS "Video" (
                "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "userId" TEXT REFERENCES "User"("id"),
                "pinterestUrl" TEXT NOT NULL,
                "status" TEXT NOT NULL DEFAULT 'QUEUED',
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "downloadedAt" TIMESTAMP WITH TIME ZONE,
                "localFilePath" TEXT,
                "youtubeVideoId" TEXT,
                "youtubeUrl" TEXT,
                "uploadedAt" TIMESTAMP WITH TIME ZONE,
                "youtubeTitle" TEXT,
                "youtubeDesc" TEXT,
                "thumbnailUrl" TEXT,
                "errorMessage" TEXT,
                "pinterestTitle" TEXT,
                "pinterestDescription" TEXT,
                "retryCount" INTEGER DEFAULT 0,
                "lastRetryAt" TIMESTAMP WITH TIME ZONE
            )
        `);

        // Add columns if they don't exist (for existing databases)
        await client.query(`
            DO $$ BEGIN
                ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER DEFAULT 0;
                ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "lastRetryAt" TIMESTAMP WITH TIME ZONE;
                ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "pinterestTitle" TEXT;
                ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "pinterestDescription" TEXT;
            EXCEPTION WHEN others THEN NULL;
            END $$;
        `);

        // Create Frame table for extracted video frames
        await client.query(`
            CREATE TABLE IF NOT EXISTS "Frame" (
                "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "videoId" UUID REFERENCES "Video"("id") ON DELETE CASCADE,
                "index" INTEGER NOT NULL,
                "timestamp" DECIMAL NOT NULL,
                "s3Url" TEXT,
                "localPath" TEXT,
                "description" TEXT,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // Create ResearchTask table for deep research tracking
        await client.query(`
            CREATE TABLE IF NOT EXISTS "ResearchTask" (
                "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                "videoId" UUID REFERENCES "Video"("id") ON DELETE CASCADE,
                "userId" TEXT REFERENCES "User"("id"),
                "status" TEXT NOT NULL DEFAULT 'pending',
                "title" TEXT,
                "description" TEXT,
                "hashtags" TEXT[],
                "thumbnailPrompt" TEXT,
                "researchInsights" TEXT,
                "theme" TEXT,
                "error" TEXT,
                "startedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "completedAt" TIMESTAMP WITH TIME ZONE,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);

        // Create indexes
        await client.query('CREATE INDEX IF NOT EXISTS "Video_userId_idx" ON "Video"("userId")');
        await client.query('CREATE INDEX IF NOT EXISTS "Video_status_idx" ON "Video"("status")');
        await client.query('CREATE INDEX IF NOT EXISTS "Video_retryCount_idx" ON "Video"("retryCount")');
        await client.query('CREATE INDEX IF NOT EXISTS "Frame_videoId_idx" ON "Frame"("videoId")');
        await client.query('CREATE INDEX IF NOT EXISTS "ResearchTask_videoId_idx" ON "ResearchTask"("videoId")');
        await client.query('CREATE INDEX IF NOT EXISTS "ResearchTask_status_idx" ON "ResearchTask"("status")');

        console.log('Database schema initialized successfully');
    } finally {
        client.release();
    }
}

// Graceful shutdown
export async function closePool(): Promise<void> {
    await pool.end();
    console.log('PostgreSQL pool closed');
}
