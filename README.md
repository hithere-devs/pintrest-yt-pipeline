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
- (Optional) ffmpeg for merging separate audio/video tracks

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

3. **Review the queue file**

   - `data/data.json` holds two arrays:
     - `videoLinks`: Pinterest URLs (either full `pinterest.com/pin/...` links
       or `pin.it` short links)
     - `videosProcessed`: Metadata for downloaded videos (filled automatically)
   - Add new links by editing the file and appending to `videoLinks`.

4. **Build and run the service**

```bash
npm run build
npm start
```

The TypeScript compiler emits to `dist/`. The server listens on
`http://localhost:4000`, triggers an immediate queue check, and then runs every
two minutes via cron. During development you can skip the build step and use the
watch mode instead:

```bash
npm run dev
```

## Endpoints

- `GET /health` — Service heartbeat and summary of the last job result.
- `GET /queue` — Current queue contents and processed entries.
- `GET /trigger-download` — Manually force the next download attempt (responds
  with job status JSON).

## Download Flow

1. The Node.js service calls a Python script (`scripts/pinterest_downloader.py`)
   that:
   - Resolves `pin.it` short URLs to full Pinterest links
   - Parses Pinterest HTML to extract video URLs
   - Handles HLS `.m3u8` playlists by converting to direct `.mp4` links
   - Downloads separate video and audio tracks when available
   - Merges tracks with ffmpeg if both exist
2. Downloaded files are saved to `downloads/` with timestamped filenames.
3. The link and file info are appended to `videosProcessed` and persisted.

If an error occurs, the job response includes the failure reason.

## Next Steps

- Wire the downloaded assets into the YouTube Data API v3 uploader.
- Add retry/backoff logic and richer logging around failures.
- Extend `videosProcessed` metadata with YouTube upload IDs once the pipeline is
  complete.

## Troubleshooting

- **Repeated downloads**: Ensure the link is listed only once in `videoLinks`,
  and that `videosProcessed` contains the corresponding entry.
- **Python errors**: Make sure the virtual environment is activated and all
  packages in `requirements.txt` are installed.
- **Missing audio**: If a video has no audio, it may use separate audio tracks
  that require ffmpeg to merge. Install ffmpeg: `brew install ffmpeg` (macOS)
- **File naming**: Files are timestamped (YYYY-MM-DDTHH-MM-SS.mp4); modify
  `scripts/pinterest_downloader.py` if you need a different scheme.

## License

MIT
