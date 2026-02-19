# SecureTrader - Trading Security Hub

## Overview
Enterprise-grade security and authentication wrapper system for an existing Python trading SaaS application (alice_blue_trail_enhanced.py). The wrapper provides authentication, encryption, device management, audit logging, and configuration management without modifying the original trading code.

## Recent Changes
- 2026-02-19: Added Test Mode scheduled start at 9:30 AM IST
  - Cron job auto-starts algorithm in test mode at 9:30 AM IST (Mon-Fri)
  - Schedule: Live 8:45 AM, Test 9:30 AM, Stop 3:10 PM, CSV Delete 3:30 PM
  - Added CSV manual delete with confirmation on both Live Logs and CSV Upload pages
- 2026-02-19: Migrated authentication from custom JWT to Replit Auth (OIDC)
  - Replaced bcrypt/JWT login with Replit OIDC authentication
  - Users table now uses Replit Auth user model (id, email, firstName, lastName, profileImageUrl)
  - Extended users table with role and isActive fields for RBAC
  - Removed old password-based auth pages (login, signup, forgot-password)
  - Sessions managed via connect-pg-simple with express-session
  - Login page now redirects to `/api/login` for Replit Auth flow
  - Old password_reset_tokens and rate_limit_entries tables removed
- 2026-02-19: Initial build of full-stack security wrapper
  - PostgreSQL schema with users, sessions, devices, audit_logs, encrypted_credentials, csv_configs
  - AES-256-GCM encryption for credentials and CSV configs
  - Rate limiting (100 req/min general)
  - Device fingerprinting with browser/OS detection
  - Role-based access control (admin, manager, support, user)
  - Security headers via Helmet
  - Dark theme by default
  - No 2FA (explicitly removed per user request)

## User Preferences
- Dark mode default for fintech professional aesthetic
- No two-factor authentication
- Original Python trading code must remain completely unchanged
- CSV configuration read externally by Python code

## Project Architecture
- **Frontend**: React + Vite + Shadcn UI + TanStack Query + wouter routing
- **Backend**: Express.js with Replit Auth (OIDC), Helmet, rate limiting
- **Database**: PostgreSQL (Neon) via Drizzle ORM
- **Encryption**: AES-256-GCM for sensitive data (credentials, CSV configs)
- **Auth**: Replit Auth (OIDC via openid-client + passport), session-based with HTTP-only cookies

### Key Files
- `shared/models/auth.ts` - Replit Auth user/session schema (users, sessions tables)
- `shared/schema.ts` - Domain schema (devices, audit_logs, encrypted_credentials, csv_configs) + re-exports auth models
- `server/replit_integrations/auth/replitAuth.ts` - OIDC auth setup, login/callback/logout routes, isAuthenticated middleware
- `server/replit_integrations/auth/storage.ts` - Auth user upsert storage
- `server/replit_integrations/auth/routes.ts` - /api/auth/user endpoint
- `server/routes.ts` - All API endpoints (dashboard, devices, credentials, CSV, admin)
- `server/storage.ts` - Database storage interface for domain entities
- `server/encryption.ts` - AES-256-GCM encryption/decryption utilities
- `client/src/hooks/use-auth.ts` - Replit Auth hook (fetches /api/auth/user)
- `client/src/lib/auth.tsx` - Auth context provider (wraps use-auth hook)
- `client/src/components/theme-provider.tsx` - Dark/light theme provider
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/pages/` - Page components (dashboard, devices, credentials, csv-config, audit-logs, settings, admin-users, admin-logs)

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session signing secret
- `ENCRYPTION_KEY` - AES-256 encryption key (64-char hex)
