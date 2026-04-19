# Google Agent Connector for Dialogflow CX, Google CES, WhatsApp, and Website Chat

Google Agent Connector, labeled in the UI as Google AI Connector, is a self-hosted admin console for routing customer conversations from WhatsApp and an embeddable website chat widget into Google agents. It is built for teams that want to connect Google Customer Engagement Suite (CES) Agent Studio or Google Conversational Agents / Dialogflow CX to real inbound channels, monitor live sessions, and enable human takeover when automation should pause.

This project is useful if you are searching for a:

- self-hosted Dialogflow CX connector
- Google Customer Engagement Suite Agent Studio connector
- WhatsApp to Dialogflow CX integration layer
- website chat widget for Google agents
- human handoff console for Google AI customer support workflows

## Overview

Google Agent Connector gives internal support and operations teams one place to:

- connect WhatsApp Cloud API and website chat widget channels
- map each channel to exactly one Google agent
- store Google credentials and channel secrets in encrypted form
- persist sessions and messages in PostgreSQL
- process inbound and outbound events through Redis and BullMQ
- monitor conversations in a dashboard with optional human takeover

The product is designed for self-hosted deployments where you want operational control over credentials, routing, auditing, and channel configuration instead of relying on a managed SaaS layer.

## Supported Google Agent Targets

Google Agent Connector currently supports two Google backends:

- Google Customer Engagement Suite (CES) Agent Studio
- Google Conversational Agents / Dialogflow CX

If you need a single admin console for both CES and Dialogflow CX environments, this repository provides that routing layer.

## Supported Channels

### WhatsApp Cloud API

Use a WhatsApp channel when you want Meta webhook traffic and outbound WhatsApp replies to flow through a mapped Google agent.

You configure:

- Meta App ID
- Meta App Secret
- Phone Number ID
- WhatsApp access token

After setup, the dashboard provides the webhook URL and verify token required in Meta.

### Website Chat Widget

Use a website widget channel when you want to embed chat on your own site and send website visitor messages to a Google agent.

You configure:

- allowed site or domain
- widget title
- optional bubble color
- optional font family

After setup, the dashboard provides the embed script to place before `</body>`.

## Core Features

### Self-Hosted Google Agent Routing

- route inbound traffic from WhatsApp or website chat to a specific Google agent
- keep channel-to-agent mappings explicit and easy to audit
- run the admin console in your own infrastructure

### Live Conversation Operations

- monitor sessions and messages in real time
- switch a conversation between `ai` mode and `human` mode
- return a session to AI later after manual intervention

### Human Takeover and Handoff

- pause AI replies when a human operator should respond
- send manual replies from the dashboard
- optionally exclude human messages from the next AI handoff context

### Secure Credential Handling

- store Google agent credentials and channel secrets in encrypted form
- verify WhatsApp webhook signatures per channel
- keep public widget and webhook endpoints isolated from dashboard authentication

## Common Use Cases

- connect WhatsApp support to Dialogflow CX
- connect WhatsApp support to Google CES Agent Studio
- embed a website chat widget that talks to a Google agent
- operate a hybrid AI plus human support workflow
- self-host a Google agent integration layer for regulated or internal environments

## How It Works

```text
WhatsApp user or website visitor
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
Dashboard shows the conversation and supports AI or human response mode
```

## Tech Stack

- Next.js 16 with App Router
- TypeScript
- PostgreSQL with Drizzle ORM
- Redis and BullMQ
- Google CES API and Dialogflow CX client libraries
- WhatsApp Cloud API
- Tailwind CSS and shadcn/ui
- Docker Compose for local and production deployment

## Prerequisites

- Node.js 20+
- pnpm
- Docker Engine with Docker Compose
- PostgreSQL
- Redis
- Google Cloud service account credentials for CES or Dialogflow CX
- Meta WhatsApp Cloud API credentials if you want WhatsApp support

## Quick Start

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

On a fresh database, the app redirects to `/setup` so you can create the initial admin account locally.

Typical setup flow:

1. Add a Google agent
2. Add a channel
3. Map the channel to the agent
4. Send test traffic through WhatsApp or the website widget
5. Monitor and manage conversations from the dashboard

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
pnpm db:repair:messages
pnpm db:studio
pnpm lint
pnpm test
```

## Production Deployment

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
- `app` to remain single-replica
- workers to scale independently

## Why Teams Use This Project

- It provides a self-hosted control plane for Google agent channel routing.
- It supports both WhatsApp and website chat without building custom glue code from scratch.
- It gives operators a practical human takeover workflow instead of forcing every session through automation.
- It keeps deployment, credentials, and message storage inside infrastructure you manage.

## FAQ

### Can I use this project as a WhatsApp to Dialogflow CX connector?

Yes. A WhatsApp channel can receive Meta webhook events, route them to a mapped Dialogflow CX agent, and return replies through the same channel.

### Can I connect Google Customer Engagement Suite Agent Studio to WhatsApp?

Yes. Google Agent Connector supports CES Agent Studio as one of its two Google backends, alongside Dialogflow CX.

### Does this include a website chat widget for Google agents?

Yes. The app serves a website widget plus its event endpoints, and the dashboard gives you the embed script after channel setup.

### Does it support live agent handoff or human takeover?

Yes. Each conversation can switch between `ai` mode and `human` mode, allowing operators to take over and later return the session to AI.

### Is this SaaS or self-hosted?

This project is self-hosted. It is intended for teams that want to run the admin console, worker, database, and queue infrastructure themselves.

## Repository Structure

- `app/`: Next.js routes, pages, and API endpoints
- `components/`: dashboard, auth, widget, and UI components
- `lib/`: auth, database, queue, encryption, and integration clients
- `worker/`: BullMQ worker entrypoint
- `tests/`: Node test suite
- `docs/DEPLOYMENT.md`: deployment and operations guide

## Security

- admin access uses signed HTTP-only session cookies
- sensitive Google and channel credentials are encrypted before storage
- WhatsApp webhook requests are verified per channel
- public webhook and widget endpoints are intentionally unauthenticated

## License

This project is licensed under the PolyForm Noncommercial License 1.0.0. See [LICENSE](LICENSE).
