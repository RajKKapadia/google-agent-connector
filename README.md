# CES Connector

CES Connector is a SaaS application that connects **WhatsApp Business** conversations to a **Google Customer Engagement Suite (CES) AI Agent Studio** app.

It lets teams:

- Receive inbound WhatsApp messages through Meta webhooks.
- Route messages to a CES AI agent for automated replies.
- Step into live conversations with **human takeover**.
- Manage multiple WhatsApp↔CES connections from one dashboard.
- Enforce subscription limits with Stripe billing.

## Architecture Overview

```text
WhatsApp User
   │ sends message
   ▼
/api/webhooks/[connectionId]
   │ verifies Meta HMAC, normalizes payload, enqueues job
   ▼
BullMQ Worker (Redis)
   │ calls CES API, persists messages, sends WhatsApp response
   ▼
PostgreSQL + SSE stream (/api/sessions/[id]/events)
   ▼
Dashboard session view (real-time updates + takeover controls)
```

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Auth:** Clerk
- **Database:** PostgreSQL + Drizzle ORM
- **Queue:** BullMQ + Redis
- **AI integration:** Google CES Agent Studio REST API
- **Messaging integration:** WhatsApp Cloud API
- **Billing:** Stripe
- **UI:** shadcn/ui + Tailwind CSS
- **Deployment:** Docker Compose (app + worker + postgres + redis)

## Prerequisites

Before running locally, make sure you have:

1. Node.js 20+
2. pnpm
3. Docker + Docker Compose
4. Accounts/credentials for:
   - Clerk
   - Meta Developer (WhatsApp Cloud API)
   - Google Cloud (CES enabled + service account)
   - Stripe (three plan price IDs)

## Quick Start (Local Development)

### 1) Install dependencies

```bash
pnpm install
```

### 2) Start Postgres + Redis

```bash
docker compose up -d
```

### 3) Create local env file

```bash
cp .env.example .env.local
```

Then fill all values in `.env.local`.

### 4) Apply database schema

```bash
pnpm db:push
```

### 5) Run the app and worker

```bash
pnpm dev:all
```

This starts:

- Next.js app on `http://localhost:3000`
- Worker process that handles queued inbound/outbound messages

## Environment Variables

Copy `.env.example` and provide values for all variables. Key settings include:

- `NEXT_PUBLIC_APP_URL`: Public app URL.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`: Clerk auth.
- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis connection string.
- `ENCRYPTION_KEY`: 64-char hex key for credential encryption.
- `WHATSAPP_APP_SECRET`: Used to verify Meta webhook signatures.
- `STRIPE_*`: Stripe API key, webhook secret, and plan price IDs.

Generate an encryption key with:

```bash
openssl rand -hex 32
```

## WhatsApp Connection Setup

After signing in to the dashboard:

1. Go to **Connections → New Connection**.
2. Enter WhatsApp credentials:
   - App ID
   - Phone Number ID
   - Access token (recommended: permanent System User token)
3. Enter CES details:
   - GCP project/location
   - CES app ID + app version
   - Service account JSON (with required CES access)
4. Save the connection.

Then configure Meta webhook:

- Webhook URL: `https://<your-domain>/api/webhooks/<connectionId>`
- Verify token: shown on the connection details page
- Subscribed field: `messages`

For local testing, expose your app with ngrok:

```bash
ngrok http 3000
```

## Human Takeover Flow

From a session page:

- **Take Over:** pauses AI replies and enables manual responses from the dashboard.
- **Return to AI:** resumes CES responses. You can optionally exclude takeover messages from AI context.

## Billing and Plan Limits

Plans are enforced server-side when creating connections:

- Starter: 1 connection
- Business: 5 connections
- Enterprise: 20 connections

Test Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Database Commands

```bash
pnpm db:generate   # Generate migration files
pnpm db:migrate    # Apply migrations
pnpm db:push       # Push schema directly (dev)
pnpm db:studio     # Open Drizzle Studio
```

## Production Deployment

Use the production compose file:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Services:

- `app` (Next.js)
- `worker` (BullMQ processor)
- `postgres`
- `redis`

Use a `.env.production` file for deployment secrets. Do not commit it.

## Project Structure

```text
app/
├── (landing)/                # Public marketing pages
├── (dashboard)/              # Authenticated product UI
├── api/webhooks/[connectionId]/route.ts
├── api/sessions/[id]/events/route.ts
└── api/stripe/webhook/route.ts

lib/
├── actions/                  # Server actions
├── ces/                      # CES API client
├── db/                       # Drizzle schema + db client
├── queue/                    # BullMQ queue + worker wiring
├── stripe/                   # Billing helpers
├── whatsapp/                 # WhatsApp client
└── encryption.ts             # AES-256-GCM encryption helpers

worker/index.ts               # Standalone worker entry point
```

## Security Notes

- Sensitive third-party credentials are encrypted before DB storage.
- Incoming WhatsApp webhooks are signature-verified.
- Clerk protects authenticated routes; webhook endpoints are intentionally public.

## Available Scripts

- `pnpm dev`: Start Next.js dev server.
- `pnpm dev:worker`: Start worker in watch mode.
- `pnpm dev:all`: Run app + worker together.
- `pnpm build`: Production build.
- `pnpm start`: Run production server.
- `pnpm lint`: Run ESLint.
