## Overview

- Pinterest downloader service written in strict TypeScript (see
  `tsconfig.json`), compiled to CommonJS, and executed via `src/index.ts`.
- Express powers a tiny API while `node-cron` triggers the same processor every
  two minutes; manual runs use `GET /trigger-download`.
- Downloads are handled by a Python script (`scripts/pinterest_downloader.py`)
  that runs in a virtual environment (`.venv/`).

## Processing pipeline

- `processNextVideo` in `src/processor.ts` is the heart of the system: load the
  queue, pick the first unprocessed link, download via Python → persist.
- Respect the `isProcessing` guard when adding async work; it prevents
  overlapping cron/manual jobs.
- Always push completed downloads via `markProcessedEntry` so the queue stays
  deduplicated.

## Queue persistence

- Queue state lives in `data/data.json`; `src/dataStore.ts` normalises shape and
  tolerates legacy string entries in `videosProcessed`.
- If you extend `QueueState`, update `types.ts`, `normaliseQueue`, and any JSON
  fixtures together.
- Persistence writes pretty JSON with a trailing newline—keep that format to
  avoid churn in diffs.

## Python downloader integration

- `src/pinterestDL.ts` spawns `scripts/pinterest_downloader.py` via the Python
  virtual environment (`.venv/bin/python`).
- The Python script handles short URL resolution, HTML parsing, HLS playlist
  processing, and file downloads.
- Returns JSON with `{success: true, filePath: "path/to/file.mp4"}` on success
  or `{success: false, error: "message"}` on failure.
- Python dependencies: `requests`, `beautifulsoup4`, `tqdm` (see
  `requirements.txt`).
- Supports automatic audio/video merging with ffmpeg when separate tracks exist.

## Downloading assets

- All downloads go to `downloads/` with ISO timestamp filenames
  (`YYYY-MM-DDTHH-MM-SS.mp4`).
- The Python script cleans up partial downloads on failure and handles multiple
  HLS quality variants (720p → 540p → 360p → 240p).
- If you modify download logic, edit `scripts/pinterest_downloader.py`, not the
  TypeScript code.

## Server surface

- `src/index.ts` exposes `/health`, `/queue`, and `/trigger-download`; responses
  always include the cached `lastJobResult` with an ISO timestamp.
- Cron schedule is currently `*/2 * * * *`; adjust in one place (`index.ts`) if
  you need different cadence.

## Developer workflow

- Install tooling with `npm install` (Node 18+) and
  `pip install -r requirements.txt` (Python 3.10+, in `.venv/`).
- Run locally with `npm run dev` (tsx watch) or `npm run build && npm start` for
  production parity.
- Generated JavaScript lands in `dist/`; `npm run clean` uses `rimraf` to reset.
- There are no automated tests yet—smoke the queue by editing `data/data.json`
  and hitting `GET /trigger-download`.

## Common extension points

- New persistence fields should be surfaced through the `/queue` endpoint so UI
  clients stay in sync.
- When integrating YouTube uploads, hook in after `downloadPinterestMedia`
  resolves and write any resulting IDs into `videosProcessed` entries.
- Prefer adding helpers alongside existing modules (`src/processor.ts`,
  `src/dataStore.ts`) to leverage their validation and error handling patterns.
- For Python script changes, test with
  `.venv/bin/python scripts/pinterest_downloader.py <url> downloads` before
  integrating.
