# SecureTrader - Trading Security Hub

## Overview
Enterprise-grade security and authentication wrapper system for an existing Python trading SaaS application (alice_blue_trail_enhanced.py). The wrapper provides authentication, encryption, device management, audit logging, and configuration management without modifying the original trading code.

## Recent Changes
- 2026-02-19: Initial build of full-stack security wrapper
  - PostgreSQL schema with users, sessions, devices, audit_logs, encrypted_credentials, password_reset_tokens, csv_configs
  - Complete authentication system (bcrypt 12+ rounds, JWT 15min access/7-day refresh tokens, HTTP-only cookies)
  - AES-256-GCM encryption for credentials and CSV configs
  - Rate limiting (5 attempts/min/IP for login, 100 req/min general)
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
- **Backend**: Express.js with JWT auth (HTTP-only cookies), bcrypt, Helmet, rate limiting
- **Database**: PostgreSQL (Neon) via Drizzle ORM
- **Encryption**: AES-256-GCM for sensitive data (credentials, CSV configs)
- **Auth**: Local auth (bcrypt + JWT), Google OAuth placeholder

### Key Files
- `shared/schema.ts` - Database schema and Zod validation schemas
- `server/routes.ts` - All API endpoints (auth, devices, credentials, CSV, admin)
- `server/storage.ts` - Database storage interface
- `server/encryption.ts` - AES-256-GCM encryption/decryption utilities
- `client/src/lib/auth.tsx` - Auth context provider
- `client/src/components/theme-provider.tsx` - Dark/light theme provider
- `client/src/components/app-sidebar.tsx` - Navigation sidebar
- `client/src/pages/` - All page components (login, signup, dashboard, devices, credentials, csv-config, audit-logs, settings, admin-users, admin-logs)

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - JWT signing secret
- `ENCRYPTION_KEY` - AES-256 encryption key (64-char hex)
