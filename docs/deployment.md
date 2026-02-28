# Deployment Guide

## Environment Variables

Copy `.env.example` and fill in all required values:

```bash
cp .env.example .env
```

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string (used for BullMQ, rate limiting, token caching) |
| `JWT_SECRET` | Access token signing key. Minimum 32 characters. |
| `JWT_REFRESH_SECRET` | Refresh token signing key. Minimum 32 characters, must differ from `JWT_SECRET`. |
| `GITHUB_CLIENT_ID` | GitHub App OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub App OAuth client secret |
| `GITHUB_APP_ID` | GitHub App ID (numeric) |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App RSA private key (PEM format) |
| `GITHUB_WEBHOOK_SECRET` | Secret for verifying GitHub webhook signatures |
| `FRONTEND_URL` | Frontend origin for CORS (e.g. `https://app.example.com`) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API listening port |
| `DB_POOL_MAX` | `20` | PostgreSQL connection pool max size |
| `NODE_ENV` | `development` | Set to `production` for production deployments |

### AI Provider Secrets

AI provider API keys are **not** Codaholiq application environment variables. They are configured as **GitHub repository secrets** on each repository that runs automations. Codaholiq itself does not store or proxy API keys — the GitHub Actions workflow accesses them directly from repository secrets at runtime.

Each provider requires specific repository secrets:

| Provider | Required Secrets | Notes |
|----------|-----------------|-------|
| **Claude Code** | `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` (optional) | Default provider |
| **OpenAI Codex** | `OPENAI_API_KEY` | Required |
| **Gemini CLI** | `GEMINI_API_KEY` | Required |
| **OpenCode** | Depends on model: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` | Only the key for the selected model's provider is needed |

Set these in each repository under **Settings > Secrets and variables > Actions**. The Codaholiq UI shows which secrets are needed when selecting a provider during automation creation.

### Generating Secrets

```bash
# JWT secrets (at least 32 characters each)
openssl rand -base64 48

# Webhook secret
openssl rand -base64 32
```

---

## Docker Deployment

The project includes a multi-stage Dockerfile that builds both the API and web app into a single image.

### Build the Image

```bash
docker build -t codaholiq:latest .
```

The image:
- Uses Node 22 Alpine
- Runs as a non-root user (`codaholiq:1001`)
- Exposes port 3000
- Includes a health check (`GET /health` every 30s)
- Contains compiled API, built web app, and database migrations

### Run with Docker Compose

For production, create a `docker-compose.prod.yml`:

```yaml
services:
  app:
    image: codaholiq:latest
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: codaholiq
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: codaholiq
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U codaholiq"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  redisdata:
```

---

## Database Migrations

Migrations must be applied before the API starts.

### Development

```bash
cd apps/api
npm run db:generate    # After schema changes
npm run db:migrate     # Apply pending migrations
npm run db:studio      # Browse data (optional)
```

### Production

Run migrations as a pre-deploy step or init container:

```bash
# From the Docker image
node -e "require('drizzle-kit').migrate()"

# Or from the host (if drizzle-kit is available)
cd apps/api && npx drizzle-kit migrate
```

> **Important**: Never mix `db:push` and `db:migrate`. Always use `db:migrate` for schema changes. If the migration state is corrupted, reset with:
> ```bash
> docker exec <postgres-container> psql -U codaholiq -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
> ```
> Then re-run `db:migrate`.

---

## Reverse Proxy

In production, place a reverse proxy (nginx, Caddy, etc.) in front of the application for TLS termination and additional security.

Example nginx config:

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate     /etc/ssl/certs/app.example.com.pem;
    ssl_certificate_key /etc/ssl/private/app.example.com-key.pem;

    # API
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }

    # Frontend (static files)
    location / {
        root /var/www/codaholiq/web;
        try_files $uri $uri/ /index.html;
    }
}
```

Key considerations:
- **SSE support**: disable proxy buffering for the `/api/orgs/:orgId/executions/:id/logs/stream` endpoint
- **Timeouts**: set `proxy_read_timeout` high enough for SSE connections (at least 60s)
- **WebSocket**: not required (Codaholiq uses SSE, not WebSockets)

---

## Health Checks

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /health` | Liveness probe | `200 { "status": "ok" }` |
| `GET /health/ready` | Readiness probe (checks DB, Redis, GitHub) | `200` or `503` with check details |

Use `/health` for container liveness and `/health/ready` for load balancer health checks.

---

## CI/CD Pipeline

The included GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on every push to `main` and on pull requests:

1. **Lint** — ESLint + Prettier
2. **Typecheck** — TypeScript compilation
3. **Security audit** — `npm audit --audit-level=high`
4. **Test** — full test suite with Postgres + Redis services
5. **Build** — production build (depends on all above passing)
6. **Docker** — builds Docker image on `main` push only

---

## Production Checklist

- [ ] All environment variables set with production values
- [ ] Unique, strong secrets for JWT and webhook (not defaults)
- [ ] `FRONTEND_URL` set to actual production domain
- [ ] HTTPS/TLS enabled via reverse proxy
- [ ] Database has automated backups
- [ ] Database uses SSL connections and strong credentials
- [ ] Redis uses a strong password and network isolation
- [ ] Migrations applied before starting the application
- [ ] GitHub App webhook URL points to production domain
- [ ] Log aggregation configured (API outputs structured JSON via Pino)
- [ ] Provider API keys configured as GitHub repository secrets on each target repository
- [ ] Monitoring/alerting on `/health/ready` endpoint
