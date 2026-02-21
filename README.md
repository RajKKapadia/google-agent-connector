# CES Connector

A SaaS platform that bridges **WhatsApp Business** with **Google Customer Engagement Suite (CES) AI Agent Studio**. Users create connections that link a WhatsApp Business number to a CES AI agent, enabling automated conversations with real-time human takeover capability.

---

## How It Works

```
WhatsApp User
     │  sends message
     ▼
POST /api/webhooks/[connectionId]   ← validates HMAC signature, enqueues job
     │
     ▼
BullMQ Worker (Redis)               ← processes message asynchronously
     │  calls CES API, sends WhatsApp reply, stores messages
     ▼
SSE /api/sessions/[id]/events       ← pushes new messages to dashboard in real-time
     ▼
Dashboard Chat View                 ← live chat with human takeover controls
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Auth | Clerk |
| Database | PostgreSQL + Drizzle ORM |
| Queue | BullMQ + Redis |
| AI Agent | Google CES Agent Studio (REST API v1beta) |
| Messaging | WhatsApp Cloud API (Meta) |
| Payments | Stripe |
| UI | shadcn/ui + Tailwind CSS |
| Deployment | Docker Compose |

---

## Prerequisites

- Node.js 20+ and pnpm
- Docker (for local PostgreSQL + Redis)
- A [Clerk](https://clerk.com) account
- A [Meta Developer](https://developers.facebook.com) account with a WhatsApp Business app
- A Google Cloud project with Customer Engagement Suite enabled and a service account
- A [Stripe](https://stripe.com) account with three subscription price IDs

---

## Local Development

### 1. Clone and install

```bash
git clone <repo-url>
cd ces-connector
pnpm install
```

### 2. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL on port `5432` and Redis on port `6379`.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_URL` | App base URL (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `ENCRYPTION_KEY` | 64-char hex key — run `openssl rand -hex 32` |
| `WHATSAPP_APP_SECRET` | Meta app secret (for HMAC webhook verification) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_STARTER_PRICE_ID` | Price ID for Starter plan ($19/mo) |
| `STRIPE_BUSINESS_PRICE_ID` | Price ID for Business plan ($49/mo) |
| `STRIPE_ENTERPRISE_PRICE_ID` | Price ID for Enterprise plan ($99/mo) |

### 4. Run database migrations

```bash
pnpm db:push
```

### 5. Start the app

```bash
# Next.js + worker together
pnpm dev:all

# Or separately
pnpm dev          # Next.js on :3000
pnpm dev:worker   # BullMQ worker
```

---

## Setting Up a WhatsApp Connection

1. **Create a connection** in the dashboard under **Connections → New Connection**. You will need:
   - WhatsApp Phone Number ID and App ID from the Meta Developer console
   - WhatsApp access token (use a permanent System User token from Meta Business Manager)
   - Google CES app details (project, location, app ID, version)
   - Google service account JSON with the CES client role

2. **Configure the Meta webhook**:
   - Use [ngrok](https://ngrok.com) in development: `ngrok http 3000`
   - Set the webhook URL in Meta to: `https://<your-domain>/api/webhooks/<connectionId>`
   - Set the verify token to the value shown on the connection detail page
   - Subscribe to the `messages` field

3. **Send a WhatsApp message** to your number — it will appear in the session dashboard in real-time.

---

## Human Takeover

On any session detail page:

- Click **Take Over** to switch from AI mode to human agent mode. The AI stops responding and you can send messages directly from the dashboard.
- Click **Return to AI** to hand back control. You can optionally exclude the human-mode messages from the AI's conversation history.

---

## Subscription Plans

| Plan | Connections | Price |
|---|---|---|
| Starter | 1 | $19/mo |
| Business | 5 | $49/mo |
| Enterprise | 20 | $99/mo |

Connection limits are enforced server-side when creating a new connection.

To test Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## Database

```bash
pnpm db:generate   # generate migration files from schema changes
pnpm db:migrate    # apply migrations
pnpm db:push       # push schema directly (dev only)
pnpm db:studio     # open Drizzle Studio in browser
```

---

## Production Deployment

The project includes Docker configuration for self-hosted VPS deployment.

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Four services run in an isolated Docker network:

- `postgres` — PostgreSQL database
- `redis` — Redis for queue and SSE pub/sub
- `app` — Next.js application (port 3000)
- `worker` — BullMQ message processing worker

Set production secrets in a `.env.production` file (never commit this file).

---

## Project Structure

```
app/
├── (landing)/          # Public marketing pages
├── (dashboard)/        # Authenticated app
│   ├── dashboard/      # Overview stats
│   ├── connections/    # Manage WhatsApp ↔ CES connections
│   ├── sessions/       # End-user chat sessions
│   └── billing/        # Subscription management
├── api/
│   ├── webhooks/[connectionId]/   # WhatsApp webhook receiver
│   ├── sessions/[id]/events/      # SSE real-time chat stream
│   └── stripe/webhook/            # Stripe billing events
lib/
├── ces/                # Google CES API client
├── whatsapp/           # WhatsApp Cloud API client
├── queue/              # BullMQ job definitions and worker
├── actions/            # Next.js Server Actions
├── db/                 # Drizzle schema and client
├── stripe/             # Stripe helpers and plan config
└── encryption.ts       # AES-256-GCM credential encryption
worker/
└── index.ts            # Standalone worker process entry point
```

---

## Security Notes

- WhatsApp access tokens and Google service account JSON are encrypted with AES-256-GCM before being stored in the database. The `ENCRYPTION_KEY` must be kept secret and must not change after data has been written.
- All incoming WhatsApp webhooks are verified with HMAC-SHA256 using the Meta app secret.
- Routes are protected by Clerk middleware — only `/api/webhooks/*` and `/api/stripe/webhook` are public.
