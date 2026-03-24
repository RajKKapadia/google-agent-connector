# CES Connector

CES Connector is a self-hosted admin console for routing customer conversations from WhatsApp and an embeddable website chat widget into Google agents.

It supports two Google targets:

- Google Customer Engagement Suite (CES) Agent Studio
- Google Conversational Agents / Dialogflow CX

The app gives an internal team one place to configure channels, map each channel to an agent, and monitor live conversations with optional human takeover.

## What the App Does

- Creates the first admin account locally on initial startup
- Stores Google agent credentials and channel secrets in encrypted form
- Accepts inbound traffic from WhatsApp Cloud API webhooks
- Serves a website chat widget plus its event endpoints
- Routes each channel to exactly one Google agent
- Persists sessions and messages in PostgreSQL
- Uses Redis and BullMQ for background processing and realtime updates
- Lets operators switch a conversation between AI mode and human mode

## How It Works

```text
WhatsApp user / website visitor
        |
        v
Public webhook or widget endpoint
        |
        v
Mapped Google agent is resolved
        |
        v
Worker processes the message and stores conversation history
        |
        v
Dashboard shows the conversation and allows human takeover
```

## Stack

- Next.js 16 with App Router
- TypeScript
- PostgreSQL with Drizzle ORM
- Redis + BullMQ
- Google CES API and Dialogflow CX client
- WhatsApp Cloud API
- Tailwind CSS + shadcn/ui
- Docker Compose for local and production deployment

## Prerequisites

- Node.js 20+
- pnpm
- Docker Engine with Docker Compose
- A PostgreSQL database
- A Redis instance
- Google Cloud service account credentials for CES or Conversational Agents
- Meta WhatsApp Cloud API credentials if you want WhatsApp support

## Local Development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start Postgres and Redis

```bash
docker compose up -d
```

### 3. Create the environment file

```bash
cp .env.example .env
```

Required values:

- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `ENCRYPTION_KEY`
- `AUTH_SESSION_SECRET`

Optional worker tuning:

- `WORKER_CONCURRENCY`
- `WORKER_SESSION_LOCK_TTL_MS`
- `WORKER_SESSION_LOCK_WAIT_MS`

Generate the secrets with:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

### 4. Run database migrations

```bash
pnpm db:migrate
```

### 5. Start the app and background worker

```bash
pnpm dev:all
```

The app runs at `http://localhost:3000`.

## First Run

On a fresh database, the app redirects to `/setup`.

Create the initial admin user there. After that, the normal flow is:

1. Add a Google agent
2. Add a channel
3. Map the channel to the agent
4. Test traffic through WhatsApp or the website widget
5. Monitor and manage conversations from the dashboard

## Channel Types

### WhatsApp

Use this when you want CES Connector to receive Meta webhook events and send outbound WhatsApp replies.

You will configure:

- Meta App ID
- Meta App Secret
- Phone Number ID
- WhatsApp access token

After creating the channel, the dashboard gives you the webhook URL and verify token needed in Meta.

### Website Widget

Use this when you want to embed a chat widget on your own site.

You will configure:

- Allowed site or domain
- Widget title
- Optional bubble color
- Optional font family

After creating the channel, the dashboard provides the embed script to place before `</body>`.

## Human Takeover

Each conversation can run in one of two modes:

- `ai`: incoming messages are routed to the configured Google agent
- `human`: an operator responds manually from the dashboard

Operators can return the session to AI mode later, and the app can exclude human messages from the next AI handoff context when needed.

## Available Commands

```bash
pnpm dev
pnpm dev:worker
pnpm dev:all
pnpm build
pnpm start
pnpm worker:start
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
pnpm lint
pnpm test
```

## Production

For a full deployment walkthrough, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Short version:

```bash
cp .env.production.example .env.production
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm worker pnpm db:migrate
docker compose -f docker-compose.prod.yml up -d --scale worker=2
```

Production expects:

- a public HTTPS URL in `NEXT_PUBLIC_APP_URL`
- a reverse proxy in front of the app
- `app` to stay single-replica
- workers to be scaled independently

## Repository Notes

- `app/`: Next.js routes, pages, and API endpoints
- `components/`: dashboard, auth, widget, and UI components
- `lib/`: auth, database, queue, encryption, and integration clients
- `worker/`: BullMQ worker entrypoint
- `tests/`: Node test suite
- `docs/DEPLOYMENT.md`: deployment and operations guide

## Security

- Admin access uses signed HTTP-only session cookies
- Sensitive Google and channel credentials are encrypted before storage
- WhatsApp webhook requests are verified per channel
- Public webhook and widget endpoints are intentionally unauthenticated

## License

This project is licensed under the PolyForm Noncommercial License 1.0.0. See [LICENSE](LICENSE).
