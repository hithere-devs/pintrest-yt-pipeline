# PM2 Background Service - Quick Reference

## 🚀 One-Command Setup

```bash
./start-pm2.sh
```

That's it! The service will:

- ✅ Run in the background 24/7
- ✅ Auto-restart on crashes
- ✅ Auto-start on system reboot
- ✅ Keep running even if you close terminal
- ✅ Process videos every 2 minutes

## 📋 Daily Commands

### Check Status

```bash
npm run pm2:status
# or
pm2 status
```

### View Logs

```bash
npm run pm2:logs
# or
pm2 logs pinterest-youtube-pipeline
```

### Restart After Code Changes

```bash
npm run pm2:deploy
# This will: build + restart
```

### Monitor Resources

```bash
npm run pm2:monit
# or
pm2 monit
```

## 🛠️ Management Commands

| Command               | Description         |
| --------------------- | ------------------- |
| `npm run pm2:start`   | Start the service   |
| `npm run pm2:stop`    | Stop the service    |
| `npm run pm2:restart` | Restart the service |
| `npm run pm2:delete`  | Remove from PM2     |
| `npm run pm2:logs`    | View logs           |
| `npm run pm2:monit`   | Monitor CPU/memory  |
| `npm run pm2:status`  | Check status        |
| `npm run pm2:deploy`  | Build and restart   |

## 📊 Understanding Status

```bash
pm2 status
```

**Status values:**

- `online` ✅ - Running normally
- `stopped` ⏸️ - Manually stopped
- `errored` ❌ - Crashed (check logs)
- `launching` 🚀 - Starting up

## 📝 Log Files

All logs are saved to `logs/` directory:

| File               | Content                       |
| ------------------ | ----------------------------- |
| `pm2-out.log`      | Standard output (console.log) |
| `pm2-error.log`    | Errors (console.error)        |
| `pm2-combined.log` | Both combined                 |

**View logs:**

```bash
# Real-time logs
npm run pm2:logs

# Last 50 lines
pm2 logs --lines 50

# Only errors
pm2 logs --err

# View specific log file
tail -f logs/pm2-out.log
```

## 🔄 Workflow

### After Code Changes

```bash
# Edit your code
vim src/processor.ts

# Deploy (build + restart)
npm run pm2:deploy

# Check if running
npm run pm2:status

# View logs to verify
npm run pm2:logs
```

### Adding New Videos to Queue

```bash
# Edit queue
vim data/data.json

# No restart needed! Service will pick it up automatically
# Check status
npm run pm2:status
```

### Checking Upload Progress

```bash
# View real-time logs
npm run pm2:logs

# Look for:
# - "Downloading video from Pinterest..."
# - "Uploading to YouTube..."
# - "Video uploaded successfully!"
# - "Rate limit: Must wait..."
```

## 🔧 Troubleshooting

### Service Not Running

```bash
# Check status
pm2 status

# If stopped, start it
npm run pm2:start

# Check for errors
pm2 logs --err --lines 100
```

### High Memory Usage

```bash
# Check resources
pm2 monit

# Restart to clear memory
npm run pm2:restart
```

### Can't See Logs

```bash
# Flush and restart
pm2 flush
npm run pm2:restart
```

### After System Reboot

```bash
# Check if auto-started
pm2 status

# If not running, the startup script wasn't set up
# Run these once:
pm2 startup
# Copy and run the command PM2 shows
pm2 save
```

## 🎯 Best Practices

### ✅ DO

- Check status daily: `npm run pm2:status`
- Monitor logs occasionally: `npm run pm2:logs`
- Use `npm run pm2:deploy` after code changes
- Keep PM2 updated: `pm2 update`
- Save after changes: `pm2 save`

### ❌ DON'T

- Don't use `npm run dev` for production
- Don't edit files in `dist/` (they're generated)
- Don't delete `ecosystem.config.js`
- Don't forget to build before restart

## 📱 Remote Monitoring (Optional)

Want to monitor from your phone? Use PM2 Plus:

```bash
# Sign up at pm2.io
pm2 link <secret_key> <public_key>

# Now monitor from anywhere!
```

## 🆘 Emergency Commands

### Service Crashed and Won't Start

```bash
# Delete and recreate
pm2 delete pinterest-youtube-pipeline
npm run build
pm2 start ecosystem.config.js
pm2 save
```

### Completely Reset PM2

```bash
# Stop all
pm2 stop all

# Delete all
pm2 delete all

# Kill PM2 daemon
pm2 kill

# Start fresh
./start-pm2.sh
```

### View Full Error Stack

```bash
pm2 logs --err --lines 200 --nostream
```

## 📖 More Information

- Full setup guide: [PM2_SETUP.md](PM2_SETUP.md)
- Rate limiting docs: [RATE_LIMITING.md](RATE_LIMITING.md)
- Project README: [README.md](README.md)
- PM2 documentation: https://pm2.keymetrics.io/

## 💡 Pro Tips

1. **Set up auto-start once:**

   ```bash
   pm2 startup
   # Run the command PM2 shows
   pm2 save
   ```

2. **Create shell aliases:**

   ```bash
   # Add to ~/.zshrc
   alias pm2s='pm2 status'
   alias pm2l='pm2 logs pinterest-youtube-pipeline'
   alias pm2r='npm run pm2:deploy'
   ```

3. **Monitor in background:**

   ```bash
   # Run in tmux/screen for persistent monitoring
   pm2 monit
   ```

4. **Check before leaving:**
   ```bash
   pm2 status && pm2 logs --lines 10
   ```

## 🎉 That's It!

Your Pinterest → YouTube pipeline now runs completely in the background. You
can:

- Close your terminal
- Restart your computer
- Go to sleep
- Travel

The service keeps running 24/7, processing videos every minute! 🚀

---

**Need help?** Check `PM2_SETUP.md` for detailed documentation.
