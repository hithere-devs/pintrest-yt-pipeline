# PM2 Process Manager Setup

This guide shows you how to run the Pinterest → YouTube pipeline as a background
service using PM2.

## Why PM2?

- ✅ Runs service in background (daemon)
- ✅ Auto-restart on crashes
- ✅ Auto-start on system reboot
- ✅ Process monitoring and logs
- ✅ Zero-downtime deployments
- ✅ Memory management
- ✅ No need to keep terminal open

## Quick Start

### 1. Install PM2 Globally

```bash
npm install -g pm2
```

### 2. Build the Project

```bash
npm run build
```

### 3. Start the Service

```bash
pm2 start ecosystem.config.js
```

### 4. Make It Auto-Start on Reboot

```bash
# Generate startup script
pm2 startup

# Copy and run the command PM2 shows you
# Example: sudo env PATH=$PATH:/usr/local/bin pm2 startup launchd -u azhar --hp /Users/azhar

# Save current process list
pm2 save
```

**Done!** The service is now running in the background and will auto-start on
system reboot. 🎉

## PM2 Commands

### Process Management

```bash
# Start the service
pm2 start ecosystem.config.js

# Stop the service
pm2 stop pinterest-youtube-pipeline

# Restart the service
pm2 restart pinterest-youtube-pipeline

# Delete the service from PM2
pm2 delete pinterest-youtube-pipeline

# Restart all processes
pm2 restart all

# Stop all processes
pm2 stop all
```

### Monitoring

```bash
# View process status
pm2 status

# Monitor CPU and memory usage in real-time
pm2 monit

# Show detailed process info
pm2 show pinterest-youtube-pipeline

# View process list
pm2 list
```

### Logs

```bash
# View all logs in real-time
pm2 logs

# View logs for specific app
pm2 logs pinterest-youtube-pipeline

# View only error logs
pm2 logs --err

# View last 100 lines
pm2 logs --lines 100

# Clear all logs
pm2 flush

# View log files directly
tail -f logs/pm2-out.log
tail -f logs/pm2-error.log
```

### Advanced

```bash
# Reload (zero-downtime restart)
pm2 reload pinterest-youtube-pipeline

# Graceful stop
pm2 stop pinterest-youtube-pipeline --wait-ready

# Update PM2
pm2 update

# Save current process list
pm2 save

# Resurrect previously saved processes
pm2 resurrect
```

## Configuration Details

### ecosystem.config.js

```javascript
{
  name: 'pinterest-youtube-pipeline',       // Process name
  script: './dist/index.js',                 // Entry point (compiled JS)
  instances: 1,                              // Single instance
  exec_mode: 'fork',                         // Fork mode (not cluster)
  autorestart: true,                         // Auto-restart on crash
  watch: false,                              // Don't watch for file changes
  max_memory_restart: '500M',                // Restart if exceeds 500MB

  // Environment variables
  env: {
    NODE_ENV: 'production',
    PORT: 4000,
  },

  // Log files
  error_file: './logs/pm2-error.log',
  out_file: './logs/pm2-out.log',
  log_file: './logs/pm2-combined.log',

  // Auto-restart daily at 3 AM (optional)
  cron_restart: '0 3 * * *',
}
```

### Log Files Location

All logs are stored in `./logs/`:

- `pm2-out.log` - Standard output (console.log)
- `pm2-error.log` - Error output (console.error)
- `pm2-combined.log` - Combined logs

## Auto-Start on System Reboot

### macOS

```bash
# Generate startup script
pm2 startup launchd

# Run the command PM2 outputs (requires sudo)
# Example:
sudo env PATH=$PATH:/usr/local/bin pm2 startup launchd -u yourusername --hp /Users/yourusername

# Save current process list
pm2 save

# Test by rebooting
sudo reboot
```

### Linux (systemd)

```bash
# Generate startup script
pm2 startup systemd

# Run the command PM2 outputs (requires sudo)
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u yourusername --hp /home/yourusername

# Save current process list
pm2 save
```

### Disable Auto-Start

```bash
pm2 unstartup
pm2 save --force
```

## Workflow

### Initial Setup

```bash
# Install dependencies
npm install
npm install -g pm2

# Build project
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Enable auto-start
pm2 startup
pm2 save

# Check status
pm2 status
```

### After Code Changes

```bash
# Rebuild
npm run build

# Restart service
pm2 restart pinterest-youtube-pipeline

# Or use reload for zero-downtime
pm2 reload pinterest-youtube-pipeline
```

### Monitoring Health

```bash
# Check if running
pm2 status

# View real-time stats
pm2 monit

# Check logs for issues
pm2 logs --lines 50
```

## Process Status Explanation

```bash
pm2 status
```

**Output:**

```
┌─────┬──────────────────────────────┬─────────┬─────────┬──────────┬────────┬──────┬──────┬──────┐
│ id  │ name                         │ mode    │ ↺      │ status   │ cpu    │ mem  │      │      │
├─────┼──────────────────────────────┼─────────┼─────────┼──────────┼────────┼──────┼──────┼──────┤
│ 0   │ pinterest-youtube-pipeline   │ fork    │ 0       │ online   │ 0%     │ 45MB │      │      │
└─────┴──────────────────────────────┴─────────┴─────────┴──────────┴────────┴──────┴──────┴──────┘
```

**Columns:**

- `id` - Process ID in PM2
- `name` - App name from config
- `mode` - Execution mode (fork/cluster)
- `↺` - Restart count
- `status` - online/stopped/errored
- `cpu` - CPU usage %
- `mem` - Memory usage

**Status Values:**

- `online` ✅ - Running normally
- `stopped` ⏸️ - Manually stopped
- `errored` ❌ - Crashed/error
- `stopping` ⏳ - Being stopped
- `launching` 🚀 - Starting up

## Troubleshooting

### Service Won't Start

```bash
# Check for errors
pm2 logs --err --lines 50

# View detailed info
pm2 show pinterest-youtube-pipeline

# Check if port is in use
lsof -i :4000

# Try manual start to see errors
node dist/index.js
```

### High Memory Usage

```bash
# Check memory
pm2 monit

# Restart to clear memory
pm2 restart pinterest-youtube-pipeline

# Adjust max_memory_restart in ecosystem.config.js
# Current: 500M (will restart if exceeds)
```

### Logs Not Showing

```bash
# Check log file permissions
ls -la logs/

# Create logs directory if missing
mkdir -p logs

# Flush and restart
pm2 flush
pm2 restart pinterest-youtube-pipeline
```

### Auto-Start Not Working

```bash
# Check startup status
pm2 startup

# Re-save process list
pm2 save

# Check startup script
# macOS: ~/Library/LaunchAgents/pm2.azhar.plist
# Linux: /etc/systemd/system/pm2-root.service

# Test by rebooting
sudo reboot
```

### Process Keeps Restarting

```bash
# Check restart count
pm2 status

# View error logs
pm2 logs --err --lines 100

# Common issues:
# - Port already in use
# - Missing .env file
# - Missing youtube-config.json or youtube-tokens.json
# - Python virtual environment not found
# - ffmpeg not installed
```

## Environment Variables

PM2 uses environment variables from:

1. `ecosystem.config.js` → `env` section
2. `.env` file (loaded by dotenv in code)

**Make sure `.env` exists:**

```bash
# Check .env file
cat .env

# Should contain:
# GEMINI_API_KEY=your_key_here
# PORT=4000
```

## Production Checklist

Before running in production:

- [ ] Install PM2 globally: `npm install -g pm2`
- [ ] Build project: `npm run build`
- [ ] Create `.env` file with `GEMINI_API_KEY`
- [ ] Set up YouTube OAuth credentials
- [ ] Create `logs/` directory: `mkdir -p logs`
- [ ] Test manual run: `node dist/index.js`
- [ ] Start with PM2: `pm2 start ecosystem.config.js`
- [ ] Enable auto-start: `pm2 startup && pm2 save`
- [ ] Test logs: `pm2 logs`
- [ ] Test reboot: Restart system and check `pm2 status`
- [ ] Monitor for 1 hour: `pm2 monit`

## Comparison: Manual vs PM2

### Manual Run (npm run dev)

```bash
npm run dev
```

❌ **Issues:**

- Must keep terminal open
- Stops when you close terminal
- No auto-restart on crash
- No auto-start on reboot
- Manual log management
- Can't run in background

### PM2 Run

```bash
pm2 start ecosystem.config.js
```

✅ **Benefits:**

- Runs in background (daemon)
- Close terminal anytime
- Auto-restart on crash
- Auto-start on reboot
- Automatic log rotation
- Process monitoring
- Resource management

## PM2 Dashboard (Optional)

PM2 offers a web dashboard for monitoring:

```bash
# Install PM2 Plus
pm2 link <secret_key> <public_key>

# Or use local web UI
pm2 web
```

Visit: http://localhost:9615

## Logs Rotation

PM2 can automatically rotate logs to prevent them from getting too large:

```bash
# Install PM2 log rotation module
pm2 install pm2-logrotate

# Configure rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

**Settings:**

- `max_size` - Max log file size before rotation (10M)
- `retain` - Number of rotated logs to keep (7)
- `compress` - Compress rotated logs (true)

## Multiple Environments

You can have different configurations for dev/staging/prod:

```javascript
// ecosystem.config.js
module.exports = {
	apps: [
		{
			name: 'pinterest-youtube-pipeline',
			script: './dist/index.js',
			env_production: {
				NODE_ENV: 'production',
				PORT: 4000,
			},
			env_development: {
				NODE_ENV: 'development',
				PORT: 4001,
			},
		},
	],
};
```

**Usage:**

```bash
# Start in production mode
pm2 start ecosystem.config.js --env production

# Start in development mode
pm2 start ecosystem.config.js --env development
```

## Useful Aliases

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
# PM2 shortcuts
alias pm2s='pm2 status'
alias pm2l='pm2 logs'
alias pm2m='pm2 monit'
alias pm2r='pm2 restart pinterest-youtube-pipeline'
alias pm2restart='npm run build && pm2 restart pinterest-youtube-pipeline'

# Reload shell
source ~/.zshrc  # or source ~/.bashrc
```

**Usage:**

```bash
pm2s          # Quick status check
pm2l          # View logs
pm2m          # Monitor resources
pm2r          # Restart service
pm2restart    # Build and restart
```

## Summary

**One-time Setup:**

```bash
npm install -g pm2
npm run build
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

**Daily Usage:**

```bash
pm2 status    # Check if running
pm2 logs      # View logs
pm2 monit     # Monitor resources
```

**After Code Changes:**

```bash
npm run build
pm2 restart pinterest-youtube-pipeline
```

**That's it!** Your Pinterest → YouTube pipeline now runs 24/7 in the
background, auto-restarts on crashes, and auto-starts on system reboot. No need
to keep terminal open or worry about the process stopping! 🚀

---

**Pro Tip:** Set up a daily cron to check PM2 status and send you alerts if the
service is down. Or use PM2 Plus for cloud monitoring.
