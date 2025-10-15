# Pinterest Video Pipeline

A Node.js service that polls a local queue of Pinterest links, downloads the
referenced videos to your machine, and tracks the processed items so they are
not fetched twice. This lays the groundwork for an automated Pinterest → YouTube
upload pipeline.

## Requirements

- Node.js 18 or newer (tested on Node 22)
- Python 3.10 or newer (tested on Python 3.13)
- macOS or Linux shell
- Network access to pinterest.com and pinimg.com
- (Optional) ffmpeg for merging separate audio/video tracks and adding
  watermarks
- YouTube Data API v3 credentials (for YouTube upload feature)
- Google Gemini API key (for AI-generated video titles and descriptions)

## Getting Started

1. **Install Node.js dependencies**

   ```bash
   npm install
   ```

2. **Set up Python environment**

   ```bash
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Google Gemini API key:

   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=4000
   ```

   Get your Gemini API key from: https://ai.google.dev/gemini-api/docs/api-key

4. **Review the queue file**

   - `data/data.json` holds two arrays:
     - `videoLinks`: Pinterest URLs (either full `pinterest.com/pin/...` links
       or `pin.it` short links)
     - `videosProcessed`: Metadata for downloaded videos (filled automatically)
   - Add new links by editing the file and appending to `videoLinks`.

5. **Build and run the service**

   **For Development (manual terminal):**

   ```bash
   npm run build
   npm start
   ```

   The TypeScript compiler emits to `dist/`. The server listens on
   `http://localhost:4000`, triggers an immediate queue check, and then runs
   every two minutes via cron. During development you can skip the build step
   and use the watch mode instead:

   ```bash
   npm run dev
   ```

   **For Production (background service with PM2):**

   See [PM2 Setup Guide](PM2_SETUP.md) for detailed instructions, or use the
   quick start script:

   ```bash
   ./start-pm2.sh
   ```

   This will:

   - Install PM2 globally (if not already installed)
   - Build the project
   - Start the service in the background
   - Enable auto-restart on crashes
   - Enable auto-start on system reboot

   **PM2 Quick Commands:**

   ```bash
   npm run pm2:status    # Check status
   npm run pm2:logs      # View logs
   npm run pm2:monit     # Monitor resources
   npm run pm2:restart   # Restart service
   npm run pm2:deploy    # Build and restart
   npm run pm2:stop      # Stop service
   ```

## YouTube Integration Setup

To enable automatic YouTube uploads after downloading Pinterest videos:

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **YouTube Data API v3**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"

### 2. Create OAuth2 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Configure consent screen if prompted:
   - User Type: External
   - Add your email as test user
   - Scopes: Add `https://www.googleapis.com/auth/youtube.upload`
4. Application type: "Web application"
5. Add authorized redirect URI: `http://localhost:4000/auth/youtube/callback`
6. Download the credentials JSON

### 3. Configure Your Application

1. Copy the example config:

   ```bash
   cp youtube-config.example.json youtube-config.json
   ```

2. Edit `youtube-config.json` with your credentials:
   ```json
   {
   	"clientId": "YOUR_CLIENT_ID.apps.googleusercontent.com",
   	"clientSecret": "YOUR_CLIENT_SECRET",
   	"redirectUri": "http://localhost:4000/auth/youtube/callback"
   }
   ```

### 4. Authenticate with YouTube

1. Start the service:

   ```bash
   npm run dev
   ```

2. Visit `http://localhost:4000/auth/youtube` in your browser

3. Sign in with your Google account and grant permissions

4. You'll be redirected back with a success message

5. Your tokens are saved in `youtube-tokens.json` (automatically created)

### 5. Upload Behavior

- **Automatic**: Videos are uploaded to YouTube after successful download (if
  authenticated)
- **Privacy**: Videos default to `private` status - you can change them to
  public in YouTube Studio
- **AI-Powered Metadata**: Each video gets AI-generated content using Google
  Gemini:
  - **Title**: SEO-friendly, engaging title (max 100 chars)
  - **Description**: Compelling 2-3 paragraph description with call-to-action
  - **Tags**: 8-10 relevant, searchable tags
  - **Branding**: Naturally includes @faith\_&_fork
  - **Fallback**: If AI fails, uses default metadata
- **Made for Kids**: Videos are marked as NOT made for kids
- **Category**: People & Blogs
- **Watermark**: Videos with merged audio/video tracks include the
  @faith\_&_fork branding overlay (bottom center)
- **Queue tracking**: YouTube video IDs and AI-generated metadata are stored in
  `videosProcessed`

### Important Notes

- **API Quotas**:
  - YouTube Data API: 10,000 units/day (each upload = 1,600 units, ~6
    videos/day)
  - Gemini API: Free tier has rate limits (check your usage at
    https://ai.google.dev)
- **Unverified Projects**: Videos from unverified API projects (created after
  July 28, 2020) are restricted to private viewing until you complete an
  [API audit](https://support.google.com/youtube/contact/yt_api_form)
- **Token Refresh**: Tokens expire after ~1 hour but are automatically refreshed
  using the refresh token
- **Authentication Check**: Visit `/auth/youtube/status` to check if you're
  authenticated
- **AI Fallback**: If Gemini API is unavailable or fails, the system
  automatically falls back to default metadata generation

## Endpoints

- `GET /health` — Service heartbeat and summary of the last job result.
- `GET /queue` — Current queue contents and processed entries (includes YouTube
  video IDs).
- `GET /trigger-download` — Manually force the next download attempt (responds
  with job status JSON).
- `GET /auth/youtube` — Start YouTube OAuth2 authentication flow.
- `GET /auth/youtube/callback` — OAuth2 callback (automatically handled).
- `GET /auth/youtube/status` — Check YouTube authentication status.

## Download Flow

1. The Node.js service calls a Python script (`scripts/pinterest_downloader.py`)
   that:
   - Resolves `pin.it` short URLs to full Pinterest links
   - Parses Pinterest HTML to extract video URLs
   - Handles HLS `.m3u8` playlists by converting to direct `.mp4` links
   - Downloads separate video and audio tracks when available
   - Merges tracks with ffmpeg and adds @faith\_&_fork watermark (bottom center)
2. Downloaded files are saved to `downloads/` with timestamped filenames.
3. If YouTube authentication is configured, the video is automatically uploaded:
   - Generates metadata (title, description, tags)
   - Uploads to YouTube as private video
   - Stores YouTube video ID in queue
4. The link and file info are appended to `videosProcessed` and persisted.

If an error occurs, the job response includes the failure reason.

## Next Steps

- Customize video metadata (title, description, tags) based on content
- Add retry/backoff logic for failed YouTube uploads
- Implement batch upload scheduling to respect API quotas
- Add webhook notifications for successful uploads
- Create admin UI for managing queue and authentication

## Troubleshooting

- **Repeated downloads**: Ensure the link is listed only once in `videoLinks`,
  and that `videosProcessed` contains the corresponding entry.
- **Python errors**: Make sure the virtual environment is activated and all
  packages in `requirements.txt` are installed.
- **Missing audio**: If a video has no audio, it may use separate audio tracks
  that require ffmpeg to merge. Install ffmpeg: `brew install ffmpeg` (macOS)
- **File naming**: Files are timestamped (YYYY-MM-DDTHH-MM-SS.mp4); modify
  `scripts/pinterest_downloader.py` if you need a different scheme.
- **YouTube upload fails**: Check that:
  - You've completed OAuth2 authentication (`/auth/youtube`)
  - Your Google Cloud project has YouTube Data API v3 enabled
  - You haven't exceeded your daily API quota (10,000 units)
  - The video file exists and is a valid MP4
- **Authentication expired**: Tokens expire after ~1 hour but should
  auto-refresh. If you see 401 errors, re-authenticate at `/auth/youtube`
- **Private videos only**: Unverified API projects (created after July 2020) can
  only upload private videos. Complete the
  [YouTube API audit](https://support.google.com/youtube/contact/yt_api_form) to
  lift this restriction.

## License

MIT
