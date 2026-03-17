# Deployment Guide for Your Hosting Plan

Your hosting plan supports Node.js, Python, SSH, and Cronjobs - so YES, this will work!

## Prerequisites

1. **PostgreSQL Database** - Ask your hosting provider if they support PostgreSQL. If not, you can use:
   - Neon (neon.tech) - Free PostgreSQL
   - Supabase - Free tier available
   - Railway PostgreSQL - Paid but integrated

## Step 1: Get Database Connection String

If your host provides PostgreSQL:
```
postgresql://username:password@localhost:5432/database_name
```

If using external PostgreSQL (Neon/Supabase):
```
postgresql://username:password@host.neon.tech/dbname?sslmode=require
```

## Step 2: Upload Files to Hosting

Upload all files to your hosting via:
- Git (recommended)
- FTP/cPanel File Manager

## Step 3: Setup Environment Variables

In your hosting panel, set these environment variables:

| Variable | Value |
|----------|-------|
| DATABASE_URL | Your PostgreSQL connection string |
| SESSION_SECRET | Random string (generate one) |
| NODE_ENV | production |

## Step 4: Install & Deploy

SSH into your server and run:

```bash
# Navigate to your project directory
cd /path/to/your/project

# Install dependencies
npm install

# Build the application
npm run build

# Setup database (creates tables)
npm run db:push
```

## Step 5: Start the Application

### Option A: Node.js App (Recommended)
In your hosting panel, set:
- Command: `npm start`
- Port: 3000 (or auto-detect)

### Option B: Using PM2 (Better for 24/7)
```bash
# Install PM2
npm install -g pm2

# Start the app
pm2 start npm --name "trading-app" -- start

# Keep it running
pm2 save
pm2 startup
```

## Step 6: Configure Domain

In your hosting panel:
1. Add domain or subdomain
2. Point to your Node.js app
3. Enable SSL (free)

## Cron Jobs

Your app already has built-in cron jobs for:
- Auto-start algorithm at 8:45 AM IST (Live mode)
- Auto-start algorithm at 9:30 AM IST (Test mode)
- Auto-stop at 3:30 PM IST

These run automatically - no extra setup needed!

## Troubleshooting

### App not starting?
- Check logs: `pm2 logs` or hosting panel logs
- Verify DATABASE_URL is set correctly
- Make sure PostgreSQL is accessible

### Python scripts not working?
- Ensure python3 is installed: `python3 --version`
- Check that required Python packages are installed

### Need help?
Check the hosting panel logs for error messages.
