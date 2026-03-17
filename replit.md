# SecureTrader - Trading Security Hub

## Overview
Enterprise-grade security and authentication wrapper system for an existing Python trading SaaS application (alice_blue_trail_enhanced.py). The wrapper provides authentication, encryption, device management, audit logging, subscription management, and configuration management without modifying the original trading code.

## Recent Changes
- 2026-03-17: Added Algo Manager page with Python script upload, paste, auto-install
  - Upload .py file or paste Python code directly in the browser
  - IST timezone (TZ=Asia/Kolkata) auto-injected when running the algo
  - Auto-detects 3rd-party imports and runs pip install for all dependencies
  - Admin-only: upload, save, delete script; all users can view script info
  - Script stored at server/algo/user_algo.py (overrides default)
  - New routes: GET/POST /api/algo/script-info, upload-script, save-script, install-deps, script-content
- 2026-03-17: Migrated to Replit environment, seeded admin user on startup
- 2026-02-22: Replaced Replit Auth with custom username/password authentication
  - bcrypt password hashing with express-session (connect-pg-simple)
  - Login rate limiting (10 attempts per 15 minutes)
  - Session cookie with httpOnly, sameSite=lax, secure in production
  - Admin default credentials: username "admin", password "admin123"
- 2026-02-22: Added subscription management system
  - 3-day free trial, monthly (₹1,000), quarterly (₹2,000), yearly (₹10,000) plans
  - Subscription enforcement middleware on live algo start and CSV upload
  - Admin can assign/terminate subscriptions for any user
  - User subscription page with plan cards and trial activation
- 2026-02-22: Enhanced admin panel
  - Create new users with username/password from admin panel
  - Manage user subscriptions (assign plans, set custom days, terminate)
  - View subscription status badges on user cards
  - Search users by name, email, or username
- 2026-02-22: Added algo log persistence to database (algo_logs table)
- 2026-02-22: Updated schedule: Live 8:45 AM, Test 9:30 AM, Stop 3:10 PM, CSV Delete 4:00 PM IST
- 2026-03-17: Updated CSV config format (user_id, password, api_key, secret_key, session_id, stocks, capital, risk_per_trade, max_daily_trades, paper_trading, test_mode, orb_range_filter, min_range_pct, max_range_pct); trading hours now 8:45 AM–3:30 PM; algo auto-starts on CSV upload during trading hours; stop cron updated to 3:30 PM, CSV delete to 3:35 PM
- 2026-02-19: Fixed Live Logs scrolling and SSE streaming
  - Rebuilt log container with proper flexbox layout (flex-1 min-h-0) for full-height scrolling
  - SSE auto-reconnects on error with 3s delay, clears logs on reconnect to avoid duplicates
  - Added SSE heartbeat (15s) on server to keep connections alive
  - Added level labels (OUT/ERR/INF/WRN) and terminal-like dark background
  - Added SSE connection status indicator ("Reconnecting..." badge)
- 2026-02-19: Initial build of full-stack security wrapper

## User Preferences
- Dark mode default for fintech professional aesthetic
- No two-factor authentication
- No OTP verification — simple username/password auth
- Original Python trading code must remain completely unchanged
- CSV configuration read externally by Python code

## Project Architecture
- **Frontend**: React + Vite + Shadcn UI + TanStack Query + wouter routing
- **Backend**: Express.js with custom auth (bcrypt + express-session), Helmet, rate limiting
- **Database**: PostgreSQL (Neon) via Drizzle ORM
- **Encryption**: AES-256-GCM for sensitive data (credentials, CSV configs)
- **Auth**: Custom username/password with bcrypt hashing, session-based with HTTP-only cookies

### Database Tables
- `users` - id, username, password (bcrypt), email, firstName, lastName, phone, role, isActive
- `sessions` - Express session store (connect-pg-simple)
- `subscriptions` - userId, plan (trial/monthly/quarterly/yearly), status, startDate, endDate, amount
- `algo_logs` - userId, runId, level, message, loggedAt
- `devices` - Device fingerprinting and tracking
- `audit_logs` - Action audit trail with severity levels
- `encrypted_credentials` - AES-256-GCM encrypted API credentials
- `csv_configs` - Encrypted CSV trading configurations

### Key Files
- `shared/models/auth.ts` - User/session schema (users, sessions tables)
- `shared/schema.ts` - Domain schema (subscriptions, algo_logs, devices, audit_logs, encrypted_credentials, csv_configs)
- `server/replit_integrations/auth/replitAuth.ts` - Custom auth setup, login/logout, isAuthenticated/isAdmin middleware
- `server/replit_integrations/auth/routes.ts` - /api/auth/user endpoint
- `server/routes.ts` - All API endpoints (auth, subscriptions, dashboard, devices, credentials, CSV, admin, algo)
- `server/storage.ts` - Database storage interface with subscription/log methods
- `server/algoRunner.ts` - Python algo process manager with cron scheduling and log persistence
- `server/encryption.ts` - AES-256-GCM encryption/decryption utilities
- `client/src/hooks/use-auth.ts` - Auth hook (login, logout, fetch user)
- `client/src/lib/auth.tsx` - Auth context provider
- `client/src/App.tsx` - Login page and authenticated layout with routing
- `client/src/components/app-sidebar.tsx` - Navigation sidebar with subscription and admin links
- `client/src/pages/subscription.tsx` - Subscription management page
- `client/src/pages/admin-users.tsx` - Admin user management with create user and subscription assignment
- `client/src/pages/live-logs.tsx` - Real-time algorithm log viewer (SSE)
- `client/src/pages/csv-upload.tsx` - CSV config upload page

### API Routes
- `POST /api/login` - Username/password login (rate limited)
- `POST /api/logout` - Logout (destroy session)
- `GET /api/auth/user` - Get current authenticated user
- `GET /api/subscription` - Get user's subscription
- `POST /api/subscription/start-trial` - Start 3-day free trial
- `POST /api/subscription/buy` - Buy a plan (monthly/quarterly/yearly)
- `POST /api/admin/users` - Create new user (admin only)
- `PATCH /api/admin/users/:id` - Update user role/status (admin only)
- `POST /api/admin/subscriptions/:userId` - Assign subscription (admin only)
- `POST /api/admin/subscriptions/:userId/terminate` - Terminate subscription (admin only)

### Trading Schedule (IST, Mon-Fri)
- 8:45 AM - Auto-start algorithm (Live Mode)
- 9:30 AM - Auto-start algorithm (Test Mode)
- 3:30 PM - Auto-stop algorithm
- 4:00 PM - Auto-delete CSV config

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session signing secret
- `ENCRYPTION_KEY` - AES-256 encryption key (64-char hex)
