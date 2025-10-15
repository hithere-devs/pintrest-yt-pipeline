# 2-Hour Upload Rate Limiting - Implementation Complete ✅

## What Changed

The system now enforces a **2-hour gap** between YouTube video uploads AND
checks the rate limit **before** downloading to save disk space. This allows you
to queue up multiple Pinterest links without worrying about uploading them all
at once or filling up your disk.

### Key Optimization: Download Only When Ready 💾

```
❌ OLD BEHAVIOR:
   Download → Check Rate Limit → Wait 2 hours → Upload → Delete
   (Video sits on disk for 2 hours!)

✅ NEW BEHAVIOR:
   Check Rate Limit → Wait 2 hours → Download → Upload → Delete
   (No disk space wasted!)
```

## Why This Matters

### Before

- ❌ All queued videos uploaded immediately
- ❌ Could hit YouTube spam filters
- ❌ No pacing control
- ❌ Risky for channel health

### After

- ✅ 2-hour gap between uploads enforced
- ✅ Add multiple links safely
- ✅ Controlled, natural pacing
- ✅ Better for YouTube algorithm
- ✅ **Saves disk space** - no download until ready to upload!

## How It Works

```
Queue: [Video1, Video2, Video3, Video4]
         ↓
Video1: Upload immediately (no previous uploads)
         ↓
Video2: Wait 2 hours after Video1
         ↓
Video3: Wait 2 hours after Video2
         ↓
Video4: Wait 2 hours after Video3
```

## Rate Limit Logic

### Check Before Download (Saves Disk Space!)

```typescript
1. Find most recent YouTube upload in queue
2. Calculate time since last upload
3. If >= 2 hours: ✅ Download → Upload → Delete
4. If < 2 hours: ⏳ Skip download (saves disk space!)
```

**Key Improvement:** Rate limit is checked **before** downloading, not after.
This means:

- 💾 No wasted disk space on videos waiting to upload
- ⚡ Faster processing (no unnecessary downloads)
- 🎯 Videos are downloaded only when ready to upload

### Time Calculation

```
Current Time - Last Upload Time >= 2 hours?
   ↓                                ↓
  YES: Upload now                  NO: Skip and show wait time
```

## Example Scenarios

### Scenario 1: First Upload

```
Queue: ["https://pin.it/video1"]
Processed: []

Result: ✅ Upload immediately (no previous uploads)
```

### Scenario 2: Second Upload Too Soon

```
Queue: ["https://pin.it/video1", "https://pin.it/video2"]
Processed: [
  { url: "video1", youtube: { uploadedAt: "2025-10-15T14:00:00Z" } }
]

Current Time: 2025-10-15T15:30:00Z (1.5 hours later)

Result: ⏳ Skip - Wait 30 more minutes
Console: "Rate limit: Must wait 30m since last upload"
```

### Scenario 3: Second Upload Ready

```
Queue: ["https://pin.it/video1", "https://pin.it/video2"]
Processed: [
  { url: "video1", youtube: { uploadedAt: "2025-10-15T14:00:00Z" } }
]

Current Time: 2025-10-15T16:15:00Z (2 hours 15 min later)

Result: ✅ Upload video2 now
```

## Console Output

### Upload Blocked (Too Soon)

```bash
⏳ Rate limit: Must wait 1h 30m since last upload (2025-10-15T14:00:00.000Z)
⏭️  Skipping download to save disk space
⏰ Next upload available in: 90 minutes

Status: skipped
```

**Note:** Video is NOT downloaded to save disk space!

### Upload Allowed (2+ Hours Passed)

```bash
Downloading video from Pinterest...
📌 Pinterest title: Delicious Pasta Recipe
Downloaded: 2025-10-15T16-30-00.mp4

Uploading to YouTube...
Generating AI-powered metadata...
✨ AI-generated metadata:
   Title: 🍝 Delicious Pasta Recipe #cooking #recipe
Uploading video: 2025-10-15T16-30-00.mp4 (1.52 MB)
Video uploaded successfully! Video ID: abc123xyz
YouTube upload complete: https://www.youtube.com/watch?v=abc123xyz
🗑️  Deleted local file: 2025-10-15T16-30-00.mp4

Status: completed
```

## Benefits

### 1. Natural Upload Schedule

- ✅ Spreads uploads throughout the day
- ✅ Mimics manual uploading behavior
- ✅ Less likely to trigger spam filters

### 2. Batch Queueing

- ✅ Add 10+ links at once
- ✅ System uploads automatically over time
- ✅ Set it and forget it

### 3. Channel Health

- ✅ Avoids "mass upload" red flags
- ✅ Better for YouTube algorithm
- ✅ More sustainable growth

### 4. API Quota Management

- ✅ Natural rate limiting
- ✅ Won't hit daily quota too fast
- ✅ Spreads API usage

### 5. Disk Space Efficiency 💾

- ✅ Videos downloaded only when ready to upload
- ✅ No intermediate storage of pending videos
- ✅ Minimal disk space usage at all times
- ✅ Downloads folder stays clean

## Workflow Example

### Monday 9:00 AM - Add 12 Videos

```bash
# Edit data/data.json
{
  "videoLinks": [
    "https://pin.it/video1",
    "https://pin.it/video2",
    "https://pin.it/video3",
    "https://pin.it/video4",
    "https://pin.it/video5",
    "https://pin.it/video6",
    "https://pin.it/video7",
    "https://pin.it/video8",
    "https://pin.it/video9",
    "https://pin.it/video10",
    "https://pin.it/video11",
    "https://pin.it/video12"
  ],
  "videosProcessed": []
}
```

### Upload Timeline (Automatic)

```
Monday 9:00 AM:  Video 1 uploads ✅
Monday 11:00 AM: Video 2 uploads ✅
Monday 1:00 PM:  Video 3 uploads ✅
Monday 3:00 PM:  Video 4 uploads ✅
Monday 5:00 PM:  Video 5 uploads ✅
Monday 7:00 PM:  Video 6 uploads ✅
Monday 9:00 PM:  Video 7 uploads ✅
Monday 11:00 PM: Video 8 uploads ✅
Tuesday 1:00 AM: Video 9 uploads ✅
Tuesday 3:00 AM: Video 10 uploads ✅
Tuesday 5:00 AM: Video 11 uploads ✅
Tuesday 7:00 AM: Video 12 uploads ✅
```

**Result:** 12 videos uploaded over 22 hours, perfectly paced!

## Technical Implementation

### Code Changes (`src/processor.ts`)

**1. Rate Limit Constant**

```typescript
// Minimum time gap between uploads (2 hours)
const UPLOAD_RATE_LIMIT_MS = 2 * 60 * 60 * 1000;
```

**2. Check Function**

```typescript
function canUploadNow(queue: QueueState): {
	canUpload: boolean;
	reason?: string;
	waitTimeMs?: number;
} {
	// Find most recent YouTube upload
	let latestUploadTime: Date | null = null;

	for (const entry of queue.videosProcessed) {
		if (typeof entry !== 'string' && entry.youtube?.uploadedAt) {
			const uploadTime = new Date(entry.youtube.uploadedAt);
			if (!latestUploadTime || uploadTime > latestUploadTime) {
				latestUploadTime = uploadTime;
			}
		}
	}

	// No previous uploads? Allow upload
	if (!latestUploadTime) {
		return { canUpload: true };
	}

	// Calculate time since last upload
	const now = new Date();
	const timeSinceLastUpload = now.getTime() - latestUploadTime.getTime();

	// Check if 2 hours passed
	if (timeSinceLastUpload >= UPLOAD_RATE_LIMIT_MS) {
		return { canUpload: true };
	}

	// Calculate wait time
	const waitTimeMs = UPLOAD_RATE_LIMIT_MS - timeSinceLastUpload;
	return {
		canUpload: false,
		reason: `Must wait ${formatTime(waitTimeMs)}`,
		waitTimeMs,
	};
}
```

**3. Upload Gate**

```typescript
// Check rate limit before uploading
const rateLimitCheck = canUploadNow(queue);

if (!rateLimitCheck.canUpload) {
	console.log(`⏳ ${rateLimitCheck.reason}`);
	return { status: 'skipped', reason: rateLimitCheck.reason };
}

// Proceed with upload...
```

## What Happens to Downloaded Videos

### Scenario: Rate Limited

1. ⏳ Rate limit check happens **BEFORE** download
2. 🚫 Download skipped (saves disk space!)
3. ⏰ Next cron run (2 minutes later) will check again
4. ✅ When 2 hours pass, downloads and uploads
5. 🗑️ File deleted after successful upload

### Important Note

**Videos are NOT downloaded if rate-limited!**

- Rate limit checked **before** download to save disk space
- Video stays in queue
- Will be retried on next cron run
- Once 2 hours pass: downloads, uploads, then deletes file

## Cron Behavior

The system runs every 2 minutes:

```
Time 0:00  - Upload Video 1 ✅
Time 0:02  - Check Video 2 ⏳ (too soon, skip)
Time 0:04  - Check Video 2 ⏳ (too soon, skip)
Time 0:06  - Check Video 2 ⏳ (too soon, skip)
...
Time 2:00  - Upload Video 2 ✅ (2 hours passed!)
Time 2:02  - Check Video 3 ⏳ (too soon, skip)
...
```

## Customizing the Rate Limit

Want a different time gap? Edit `src/processor.ts`:

### 1 Hour Gap

```typescript
const UPLOAD_RATE_LIMIT_MS = 1 * 60 * 60 * 1000; // 1 hour
```

### 3 Hour Gap

```typescript
const UPLOAD_RATE_LIMIT_MS = 3 * 60 * 60 * 1000; // 3 hours
```

### 30 Minutes (Testing)

```typescript
const UPLOAD_RATE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
```

### No Rate Limit (Immediate)

```typescript
const UPLOAD_RATE_LIMIT_MS = 0; // No delay
```

## Monitoring & Debugging

### Check Last Upload Time

```bash
# View data/data.json
cat data/data.json | jq '.videosProcessed[-1].youtube.uploadedAt'

# Output: "2025-10-15T14:00:00.000Z"
```

### Calculate Next Available Upload

```bash
# Get last upload time + 2 hours
# If last upload: 2025-10-15 14:00:00
# Next available: 2025-10-15 16:00:00
```

### Force Upload (Override Rate Limit)

If you need to override the rate limit temporarily:

**Option 1:** Set rate limit to 0

```typescript
const UPLOAD_RATE_LIMIT_MS = 0;
```

**Option 2:** Manually edit upload time in `data/data.json`

```json
{
	"youtube": {
		"uploadedAt": "2025-10-15T12:00:00.000Z" // Change to earlier time
	}
}
```

## Error Handling

### What If Download Fails?

```
1. Download fails ❌
2. Error logged
3. Queue unchanged (video not marked processed)
4. Next cron run will retry download
5. Rate limit not affected (no upload attempt)
```

### What If Upload Fails After Rate Check?

```
1. Rate limit check passes ✅
2. Download succeeds ✅
3. Upload fails ❌
4. Video NOT marked as processed
5. File kept in downloads/
6. Next cron run will retry (must pass rate limit again)
```

## Best Practices

### 1. Queue Management

✅ **Do:**

- Add multiple videos at once
- Let system pace uploads automatically
- Check logs for rate limit messages

❌ **Don't:**

- Manually trigger uploads repeatedly
- Modify upload times in JSON
- Disable rate limiting in production

### 2. Scheduling

✅ **Optimal:**

- Add 6-12 videos per batch
- System uploads over 12-24 hours
- Natural, sustainable pace

❌ **Avoid:**

- Adding 50+ videos at once
- Expecting all to upload same day
- Bypassing rate limits

### 3. Monitoring

✅ **Check:**

- Last upload time in logs
- Videos waiting in queue
- Wait times in console

❌ **Ignore:**

- "Rate limit" messages (they're normal!)
- Queue size (system handles it)

## Future Enhancements

Potential improvements:

### 1. Smart Scheduling

- Upload during optimal times (peak viewer hours)
- Adjust based on time zones
- Avoid night/early morning uploads

### 2. Dynamic Rate Limiting

- Faster uploads if channel is established
- Slower for new channels
- Adjust based on video performance

### 3. Priority Queue

- Mark videos as "high priority"
- Upload ASAP when rate limit allows
- Regular videos fill remaining slots

### 4. Dashboard

- Show next upload time
- Display queue status
- Visual timeline of uploads

## Troubleshooting

### "All uploads skipped, nothing happening"

**Check:**

1. Last upload time in `data/data.json`
2. Current time vs last upload + 2 hours
3. Console shows "Rate limit: Must wait X"

**Solution:**

- Wait for time to pass (normal behavior!)
- Or adjust `UPLOAD_RATE_LIMIT_MS` for testing

### "Rate limit not working, uploads too fast"

**Check:**

1. Rate limit constant in `src/processor.ts`
2. Rebuild after changes: `npm run build`
3. Restart service

**Solution:**

```bash
npm run build
npm run dev  # Restart
```

### "Videos stuck in queue, not uploading"

**Check:**

1. Authentication status
2. Rate limit messages in logs
3. Previous upload timestamps

**Solution:**

- Check `/auth/youtube/status`
- Review `data/data.json` for last upload time
- Wait for rate limit period

## API Endpoints

Check upload status via API:

### Get Queue Status

```bash
curl http://localhost:4000/queue
```

**Response includes:**

```json
{
	"videosProcessed": [
		{
			"url": "https://pin.it/abc123",
			"youtube": {
				"uploadedAt": "2025-10-15T14:00:00.000Z"
			}
		}
	],
	"videoLinks": ["https://pin.it/next-video"]
}
```

Calculate next upload:

- Last upload: `uploadedAt`
- Next available: `uploadedAt + 2 hours`

## Summary

**What you can do now:**

1. ✅ **Add multiple Pinterest links**

   ```json
   {
   	"videoLinks": ["link1", "link2", "link3", "link4", "link5"]
   }
   ```

2. ✅ **System paces uploads automatically**

   - 2-hour gap between each
   - Natural, sustainable schedule
   - No manual intervention

3. ✅ **Monitor progress**
   - Console shows wait times
   - Logs show rate limit messages
   - Queue tracks all uploads

**Result:** Safe, controlled YouTube upload schedule that protects your channel!
🎉

---

**Upload Schedule: One video every 2 hours, automatically managed!**
