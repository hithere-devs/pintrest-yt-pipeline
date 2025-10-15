# Changelog

## [Unreleased] - 2025-10-15

### Changed - Rate Limit Optimization

**Problem:** Videos were being downloaded and stored on disk even when they
couldn't be uploaded due to rate limiting, wasting disk space.

**Solution:** Moved rate limit check **before** download instead of after.

#### Before

```typescript
// Old flow:
1. Download video from Pinterest (uses disk space)
2. Check if rate limit allows upload
3. If rate limited: Keep file on disk, wait 2 hours
4. If allowed: Upload then delete
```

**Issues:**

- Videos sat on disk for up to 2 hours
- Wasted disk space on queued videos
- Multiple videos could accumulate in downloads folder

#### After

```typescript
// New flow:
1. Check if rate limit allows upload
2. If rate limited: Skip download entirely (saves disk space!)
3. If allowed: Download → Upload → Delete
```

**Benefits:**

- ✅ No disk space wasted on pending videos
- ✅ Downloads folder stays minimal
- ✅ Videos downloaded only when ready to upload
- ✅ Faster processing (no unnecessary downloads)

#### Code Changes

**File:** `src/processor.ts`

**Change:** Moved rate limit check before `downloadPinterestMedia()` call

```diff
  const queue = await loadQueue();
  nextLink = getNextUnprocessedLink(queue);

  if (!nextLink) {
      return { status: 'idle', reason: 'No new video links to process.' };
  }

+ // Check rate limit BEFORE downloading to save disk space
+ if (isAuthenticated()) {
+     const rateLimitCheck = canUploadNow(queue);
+
+     if (!rateLimitCheck.canUpload) {
+         console.log(`⏳ ${rateLimitCheck.reason}`);
+         console.log(`⏭️  Skipping download to save disk space`);
+         console.log(`⏰ Next upload available in: ${Math.ceil((rateLimitCheck.waitTimeMs || 0) / 60000)} minutes`);
+
+         return {
+             status: 'skipped',
+             reason: rateLimitCheck.reason || 'Rate limit exceeded',
+         };
+     }
+ }

  const downloadResult = await downloadPinterestMedia(nextLink);
  const filePath = downloadResult.filePath;

- // Check rate limit before uploading
- const rateLimitCheck = canUploadNow(queue);
-
- if (!rateLimitCheck.canUpload) {
-     console.log(`⏳ ${rateLimitCheck.reason}`);
-     console.log(`📁 Video downloaded but not uploaded yet`);
-     return { status: 'skipped', reason: rateLimitCheck.reason };
- }
```

#### Console Output Comparison

**Old Output (Rate Limited):**

```bash
Downloading video from Pinterest...
📌 Pinterest title: Delicious Pasta Recipe
Downloaded: 2025-10-15T15-30-00.mp4

⏳ Rate limit: Must wait 1h 30m since last upload
📁 Video downloaded but not uploaded yet: 2025-10-15T15-30-00.mp4
⏰ Next upload available in: 90 minutes

# File sits on disk for 90 minutes! 💾
```

**New Output (Rate Limited):**

```bash
⏳ Rate limit: Must wait 1h 30m since last upload
⏭️  Skipping download to save disk space
⏰ Next upload available in: 90 minutes

# No file downloaded, no disk space used! ✨
```

#### Impact

**Disk Space Savings:**

- Average video size: ~2-5 MB
- Queue of 10 videos: 20-50 MB saved
- Queue of 50 videos: 100-250 MB saved

**Example Timeline (10 Videos Queued):**

**Old Behavior:**

```
Time 0:00  - Download Video 1 (2 MB) → Upload ✅ → Delete
Time 0:02  - Download Video 2 (3 MB) → Rate limited ⏳
Time 0:04  - Download Video 3 (2 MB) → Rate limited ⏳
Time 0:06  - Download Video 4 (4 MB) → Rate limited ⏳
...
Disk usage at 0:06: 9 MB (3 videos waiting)
```

**New Behavior:**

```
Time 0:00  - Upload Video 1 ✅
Time 0:02  - Rate limited, no download ⏳
Time 0:04  - Rate limited, no download ⏳
Time 0:06  - Rate limited, no download ⏳
...
Disk usage at 0:06: 0 MB (nothing waiting!)
```

### Documentation Updates

- Updated `RATE_LIMITING.md` with new behavior
- Added disk space benefits section
- Updated console output examples
- Added visual comparison diagrams

---

## [v1.0.0] - 2025-10-15

### Added

- YouTube Data API v3 integration
- Google Gemini AI for title/description generation
- Pinterest metadata extraction (title, description, keywords)
- ffmpeg watermark (@faith\_&_fork branding)
- Hashtag optimization in titles and descriptions
- Auto-cleanup of files after upload
- 2-hour rate limiting between uploads
- OAuth2 authentication for YouTube

### Features

- Automated video download from Pinterest
- AI-generated metadata with Pinterest context
- Automatic YouTube upload with proper metadata
- Rate-limited uploads (2-hour gap)
- Queue management in `data/data.json`
- Cron job every 2 minutes
