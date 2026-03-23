# CES Connector

CES Connector is a self-hosted admin console for routing WhatsApp and website widget conversations into Google Customer Engagement Suite (CES) agents.

## What It Does

- Create a local admin account on first run.
- Add Google CX agents with CES app version + service account credentials.
- Add WhatsApp channels and website widget channels.
- Map each channel to exactly one agent.
- View live conversations and switch between AI mode and human takeover.

## Architecture Overview

```text
WhatsApp User / Website Visitor
   │
   ▼
Channel endpoint (/api/webhooks/[connectionId] or /api/widget/[connectionId])
   │ resolves mapped agent
   ▼
BullMQ Worker / direct widget execution
   │ calls CES API, persists messages, publishes realtime updates
   ▼
PostgreSQL + Redis pub/sub + SSE
   ▼
Admin Console (/dashboard, /channels, /agents, /mappings, /conversations)
```

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Local admin auth using signed HTTP-only cookies
- PostgreSQL + Drizzle ORM
- BullMQ + Redis
- Google CES Agent Studio REST API
- WhatsApp Cloud API
- shadcn/ui + Tailwind CSS
- Docker Compose deployment

## Prerequisites

1. Node.js 20+
2. pnpm
3. Docker + Docker Compose
4. Credentials for:
   - Meta Developer / WhatsApp Cloud API
   - Google Cloud with CES enabled and a service account JSON

## Quick Start

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
cp .env.example .env
```

Fill these values in `.env`:

- `NEXT_PUBLIC_APP_URL`
- `AUTH_SESSION_SECRET`
- `DATABASE_URL`
- `REDIS_URL`
- `ENCRYPTION_KEY`

Generate secrets with:

```bash
openssl rand -hex 32   # ENCRYPTION_KEY
openssl rand -hex 32   # AUTH_SESSION_SECRET
```

### 4) Apply the database migration

```bash
pnpm db:migrate
```

### 5) Start the app and worker

```bash
pnpm dev:all
```

The app opens at `http://localhost:3000`.

## First Run

When no admin user exists, `/setup` is shown automatically.

Create the initial admin account, then log in to the internal dashboard.

## Admin Workflow

1. Add a Google CX agent.
2. Add a WhatsApp channel or website widget channel.
3. Map the channel to an agent.
4. Configure the public integration:
   - WhatsApp: use the webhook URL + verify token shown on the channel detail page.
   - Website widget: use the generated embed script shown on the channel detail page.
5. Monitor and manage conversations from `/conversations`.

## Human Takeover

From a conversation page:

- `Take Over` pauses AI replies.
- `Return to AI` resumes CES replies.
- Human messages can optionally be excluded from the AI handoff context.

## Database Commands

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:repair:messages
pnpm db:studio
```

## Production Deployment

```bash
docker compose -f docker-compose.prod.yml up -d --build --scale worker=2
pnpm db:migrate
```

Services:

- `app`
- `worker`
- `postgres`
- `redis`

The production stack keeps `app` as a single replica and scales only the queue worker.

Optional worker tuning in `.env.production`:

- `WORKER_CONCURRENCY=5`
- `WORKER_SESSION_LOCK_TTL_MS=120000`
- `WORKER_SESSION_LOCK_WAIT_MS=30000`

Guidance:

- Increase `--scale worker=N` to process more independent conversations in parallel.
- Increase `WORKER_CONCURRENCY` only when each worker instance still has headroom.
- Messages for the same WhatsApp session are serialized with a Redis lock so scaled workers do not race each other.

## Security Notes

- Admin auth uses a signed HTTP-only session cookie.
- Sensitive channel and agent credentials are encrypted before storage.
- WhatsApp webhook signatures are verified per channel.
- Public widget and webhook endpoints remain unauthenticated by design.

