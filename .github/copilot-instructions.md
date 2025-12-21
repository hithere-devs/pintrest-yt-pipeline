## Overview

Pinterest-to-YouTube automation pipeline with a React dashboard. The backend
(`src/`) is TypeScript/Express with PostgreSQL; the frontend (`ui/`) is Vite +
React + Tailwind. Node-cron processes the queue every minute; Python handles
actual Pinterest downloads.

## Architecture

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌───────────┐
│  React UI   │───▶│  Express API     │───▶│  PostgreSQL     │    │  GCS/S3   │
│  (ui/)      │    │  (src/index.ts)  │    │  (pgClient.ts)  │    │  Storage  │
└─────────────┘    └────────┬─────────┘    └─────────────────┘    └───────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
    ┌────────────┐   ┌────────────┐   ┌────────────────┐
    │ processor  │   │ Python DL  │   │ YouTube API    │
    │ (cron job) │   │ (spawn)    │   │ (googleapis)   │
    └────────────┘   └────────────┘   └────────────────┘
```

**Key modules:**

- `src/processor.ts` — Heart of the system: picks next queued video, downloads
  via Python, uploads to YouTube
- `src/db.ts` — All video/user/frame CRUD operations against PostgreSQL
- `src/db/viralVideo.ts` — Asset library and viral video project management
- `src/pinterestDL.ts` — Spawns Python script, parses JSON response
- `src/youtubeUploader.ts` — OAuth2 flow, video upload, metadata generation
- `src/aiContentGenerator.ts` — Gemini AI for titles/descriptions (uses
  `@google/genai`)
- `src/deepResearch.ts` — Deep research via Gemini for enhanced content

## Authentication & Authorization

- Google OAuth2 handles both YouTube access AND user identity
- `src/authMiddleware.ts`: `requireAuth` middleware verifies JWT id_token
- User ID = Google's `sub` claim; stored in `User.id` (TEXT, not UUID)
- Frontend stores `auth_token` in localStorage; sends as `Bearer` header
- All `/queue/*`, `/videos/*`, `/frames/*` endpoints are protected

## Data Layer

- PostgreSQL via `src/pgClient.ts`; schema in `supabase_schema.sql`
- `Video` table tracks status: `QUEUED → PROCESSING → DOWNLOADED → UPLOADED` (or
  `FAILED`)
- Retry logic: failed videos retry up to `MAX_RETRIES=3` with exponential
  backoff
- Rate limit: 2-hour gap between uploads per user (YouTube quota protection)
- Legacy `data/data.json` still exists but primary storage is PostgreSQL

## Processing Pipeline

The `processNextVideo()` function in `src/processor.ts`:

1. Checks `isProcessing` guard (prevents overlapping jobs)
2. Fetches next `QUEUED` video or retries a `FAILED` one
3. Rate-limits against `UPLOAD_RATE_LIMIT_MS` (2 hours)
4. Spawns Python downloader → saves to `downloads/`
5. Generates metadata via Gemini AI
6. Uploads to YouTube with user's OAuth tokens
7. Cleans up local file; updates DB status

## Python Downloader

- Script: `scripts/pinterest_downloader.py`
- Spawned via: `.venv/bin/python` (virtual env required)
- Returns JSON: `{success: true, filePath: "...", metadata: {...}}`
- Handles: short URL resolution, HLS playlists, audio/video merging (ffmpeg)
- Test standalone:
  `.venv/bin/python scripts/pinterest_downloader.py <url> downloads`

## Developer Workflow

```bash
# Backend
npm install && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
npm run dev          # tsx watch mode on :4000

# Frontend
cd ui && npm install && npm run dev   # Vite on :5173

# Production
npm run build && npm start   # or use PM2: ./start-pm2.sh
```

**Environment variables** (see `.env.example`):

- `DATABASE_URL` — PostgreSQL connection string
- `GEMINI_API_KEY` — Google Gemini for AI content
- `GCS_BUCKET_NAME`, `GCS_PROJECT_ID` — Google Cloud Storage
- `PORT` — API port (default 4000)

## Code Conventions

- Strict TypeScript (`tsconfig.json`); compiled to CommonJS in `dist/`
- All DB functions use `query<T>()` / `queryOne<T>()` from `pgClient.ts`
- New video statuses: add to `VideoStatus` union in `types.ts`
- API responses include `lastJobResult` for UI polling
- When extending DB schema: update both `pgClient.ts` (auto-migration) and
  `supabase_schema.sql`

## Frontend (ui/)

- Vite + React 18 + TypeScript + Tailwind
- `ui/src/api.ts`: `fetchWithAuth()` — wraps all API calls with auth token
- `ui/src/context/AuthContext.tsx` — manages auth state, token verification
- Pages: Dashboard, Queue, History, VideoDetail, ViralVideoGenerator
- `VITE_API_URL` env var controls backend URL

## Extension Points

- **New API endpoint**: Add to `src/index.ts`, protect with `requireAuth`
- **New video status**: Update `types.ts` → `db.ts` queries → UI components
- **Cloud storage**: `gcsClient.ts` (GCS) or `s3Client.ts` (AWS) — both patterns
  available
- **AI features**: Extend `aiContentGenerator.ts` or use `DeepResearch` class
- **Video processing**: Modify Python script, not TypeScript (`pinterestDL.ts`
  is just a spawner)
