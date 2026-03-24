# Deployment Guide

This guide covers two supported ways to run CES Connector:

- local development on your machine
- production deployment on a single server with Docker Compose

## What You Need

- Node.js 20 or newer
- pnpm
- Docker Engine with Docker Compose
- A PostgreSQL-compatible connection string and Redis URL
- A public HTTPS URL if you plan to use WhatsApp webhooks or the website widget
- Credentials for:
  - Meta Developer / WhatsApp Cloud API
  - Google Cloud with CES enabled and a service account JSON

## Environment Files

### Local development

Copy `.env.example` to `.env`.

```bash
cp .env.example .env
```

Set these required values:

- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `ENCRYPTION_KEY`
- `AUTH_SESSION_SECRET`

Generate the two secrets with:

```bash
openssl rand -hex 32
```

### Production

Copy `.env.production.example` to `.env.production`.

```bash
cp .env.production.example .env.production
```

Update these values before starting the stack:

- `NEXT_PUBLIC_APP_URL`
  - Use the final public HTTPS URL, for example `https://connector.example.com`.
- `DATABASE_URL`
  - Keep the hostname as `postgres` when using `docker-compose.prod.yml`.
- `REDIS_URL`
  - Keep the hostname as `redis` when using `docker-compose.prod.yml`.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
  - These values must match the credentials embedded in `DATABASE_URL`.
- `ENCRYPTION_KEY`
- `AUTH_SESSION_SECRET`

## Local Development

1. Install dependencies.

```bash
pnpm install
```

2. Start Postgres and Redis.

```bash
docker compose up -d
```

3. Apply the database migration.

```bash
pnpm db:migrate
```

4. Start the Next.js app and the background worker.

```bash
pnpm dev:all
```

The app is available at `http://localhost:3000`.

## Production Deployment

The production compose file starts four services:

- `app`
- `worker`
- `postgres`
- `redis`

### 1. Prepare the host

- Use a Linux server or VM with Docker installed.
- Point your domain to the server.
- Put a reverse proxy such as Nginx, Caddy, or Traefik in front of port `3000`.
- Terminate TLS at the proxy so `NEXT_PUBLIC_APP_URL` can stay on HTTPS.

### 2. Create the production env file

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and replace all placeholder secrets.

### 3. Build and start the stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Run database migrations

Run migrations inside the `worker` image. This image contains the source code, `pnpm`, and the same environment as the running stack.

```bash
docker compose -f docker-compose.prod.yml run --rm worker pnpm db:migrate
```

### 5. Scale workers if needed

The web app should stay as a single replica. Scale only the queue worker.

```bash
docker compose -f docker-compose.prod.yml up -d --scale worker=2
```

### 6. Verify first access

- Open the app in the browser.
- On first run, the app redirects to `/setup`.
- Create the initial admin account.
- Add at least one Google agent, one channel, and one mapping before testing external traffic.

## Operational Notes

### Worker scaling

- Increase `--scale worker=N` to process more independent conversations in parallel.
- Increase `WORKER_CONCURRENCY` only when each worker instance still has CPU and memory headroom.
- Messages for the same WhatsApp session are serialized with a Redis lock so multiple workers do not process them at the same time.

### Upgrades

When you pull a new version:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm worker pnpm db:migrate
```

### Backups

Back up the Docker volumes used by:

- `postgres_data`
- `redis_data`

PostgreSQL backups are the critical requirement. Redis mainly stores transient queue and realtime state.

## Troubleshooting

### Widget or webhook URLs are wrong

`NEXT_PUBLIC_APP_URL` is incorrect. Update it to the final public HTTPS URL and restart the stack.

### The app starts but background processing does not happen

Check the `worker` container logs first:

```bash
docker compose -f docker-compose.prod.yml logs -f worker
```

### Database migration cannot connect

Make sure:

- the stack is already running
- `DATABASE_URL` uses the `postgres` hostname in `.env.production`
- the credentials in `DATABASE_URL` match `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`

