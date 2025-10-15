#!/bin/bash

# Pinterest → YouTube Pipeline - PM2 Quick Start Script
# This script automates the PM2 setup process

set -e  # Exit on error

echo "🚀 Pinterest → YouTube Pipeline - PM2 Setup"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 is not installed globally${NC}"
    echo "Installing PM2 globally..."
    npm install -g pm2
    echo -e "${GREEN}✅ PM2 installed successfully${NC}"
    echo ""
else
    echo -e "${GREEN}✅ PM2 is already installed${NC}"
    echo ""
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create a .env file with GEMINI_API_KEY"
    echo ""
    echo "Example:"
    echo "  GEMINI_API_KEY=your_api_key_here"
    echo "  PORT=4000"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ .env file found${NC}"
echo ""

# Create logs directory
if [ ! -d "logs" ]; then
    mkdir -p logs
    echo -e "${GREEN}✅ Created logs directory${NC}"
else
    echo -e "${GREEN}✅ Logs directory exists${NC}"
fi
echo ""

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo ""

# Check if process is already running
if pm2 describe pinterest-youtube-pipeline > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Process is already running${NC}"
    echo "Restarting..."
    pm2 restart pinterest-youtube-pipeline
    echo -e "${GREEN}✅ Process restarted${NC}"
else
    echo "🚀 Starting process with PM2..."
    pm2 start ecosystem.config.js
    echo -e "${GREEN}✅ Process started${NC}"
fi
echo ""

# Save process list
echo "💾 Saving PM2 process list..."
pm2 save
echo -e "${GREEN}✅ Process list saved${NC}"
echo ""

# Show status
echo "📊 Current status:"
pm2 status
echo ""

# Show logs info
echo "📝 View logs with:"
echo "  pm2 logs pinterest-youtube-pipeline"
echo ""

# Setup startup script
echo -e "${YELLOW}⚙️  Setting up auto-start on system reboot...${NC}"
echo ""
pm2 startup || true
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Copy and run the command above (if shown) to enable auto-start${NC}"
echo -e "${YELLOW}   Then run: pm2 save${NC}"
echo ""

echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "Quick commands:"
echo "  npm run pm2:status    - Check status"
echo "  npm run pm2:logs      - View logs"
echo "  npm run pm2:monit     - Monitor resources"
echo "  npm run pm2:restart   - Restart service"
echo "  npm run pm2:stop      - Stop service"
echo ""
echo "Service is now running in the background! 🚀"
