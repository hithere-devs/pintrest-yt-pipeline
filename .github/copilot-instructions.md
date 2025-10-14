## Overview

- Pinterest downloader service written in strict TypeScript (see
  `tsconfig.json`), compiled to CommonJS, and executed via `src/index.ts`.
- Express powers a tiny API while `node-cron` triggers the same processor every
  two minutes; manual runs use `GET /trigger-download`.

## Processing pipeline

- `processNextVideo` in `src/processor.ts` is the heart of the system: load the
  queue, pick the first unprocessed link, resolve → scrape → download → persist.
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

## Pinterest integration

- `src/pinterestClient.ts` handles both `pin.it` short links and canonical pins;
  reuse `resolvePinUrl` before hitting Pinterest.
- DOM parsing relies on Cheerio selectors targeting `.hwa.kVc.MIw.L4E`; fall
  back to any `<video>` whose `src` includes `pinimg.com`.
- `promoteMp4Url` upgrades HLS playlists by swapping `hls` → `720p` and `m3u8` →
  `mp4`; preserve this when altering download quality.
- All Pinterest requests must include the desktop headers from `DEFAULT_HEADERS`
  to avoid 403s.

## Downloading assets

- `src/downloader.ts` streams MP4s to `downloads/` and cleans up partial files
  on failure; call `downloadVideo` instead of rolling your own HTTP fetch.
- Filenames are timestamp-prefixed and sanitized; if you change `buildFilename`,
  ensure extensions remain accurate or caller code may mis-handle files.

## Server surface

- `src/index.ts` exposes `/health`, `/queue`, and `/trigger-download`; responses
  always include the cached `lastJobResult` with an ISO timestamp.
- Cron schedule is currently `*/2 * * * *`; adjust in one place (`index.ts`) if
  you need different cadence.

## Developer workflow

- Install tooling with `npm install` (Node 18+); run locally with `npm run dev`
  (tsx watch) or `npm run build && npm start` for production parity.
- Generated JavaScript lands in `dist/`; `npm run clean` uses `rimraf` to reset.
- There are no automated tests yet—smoke the queue by editing `data/data.json`
  and hitting `GET /trigger-download`.

## Common extension points

- New persistence fields should be surfaced through the `/queue` endpoint so UI
  clients stay in sync.
- When integrating YouTube uploads, hook in after `downloadVideo` resolves and
  write any resulting IDs into `videosProcessed` entries.
- Prefer adding helpers alongside existing modules (`src/processor.ts`,
  `src/dataStore.ts`) to leverage their validation and error handling patterns.
