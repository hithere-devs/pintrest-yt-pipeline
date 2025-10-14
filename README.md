# Pinterest Video Pipeline

A Node.js service that polls a local queue of Pinterest links, downloads the
referenced videos to your machine, and tracks the processed items so they are
not fetched twice. This lays the groundwork for an automated Pinterest → YouTube
upload pipeline.

## Requirements

- Node.js 18 or newer (tested on Node 22)
- macOS or Linux shell
- Network access to pinterest.com and pinimg.com

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Review the queue file**

   - `data/data.json` holds two arrays:
     - `videoLinks`: Pinterest URLs (either full `pinterest.com/pin/...` links
       or `pin.it` short links)
     - `videosProcessed`: Metadata for downloaded videos (filled automatically)
   - Add new links by editing the file and appending to `videoLinks`.

3. **Build and run the service**

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

1. Resolve `pin.it` short URLs to their full Pinterest counterparts.
2. Parse the Pinterest HTML to locate the video source, upgrading `.m3u8`
   playlists to `.mp4` when possible.
3. Download the MP4 stream to `downloads/` with a timestamped filename.
4. Append the link and file info to `videosProcessed` and persist the queue.

If an error occurs (e.g., Pinterest layout changes or a 403), the job response
includes the failure reason so you can adjust quickly.

## Next Steps

- Wire the downloaded assets into the YouTube Data API v3 uploader.
- Add retry/backoff logic and richer logging around failures.
- Extend `videosProcessed` metadata with YouTube upload IDs once the pipeline is
  complete.

## Troubleshooting

- **Repeated downloads**: Ensure the link is listed only once in `videoLinks`,
  and that `videosProcessed` contains the corresponding entry.
- **403/Access errors**: Pinterest may block requests without realistic headers;
  update the client headers in `src/pinterestClient.js` if needed.
- **File naming**: Files are timestamped; adjust `buildFilename` in
  `src/downloader.js` if you prefer a different scheme.

## License

MIT
