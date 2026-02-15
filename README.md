<p align="center">
  <img src="apps/web/public/codaholiq_logo.png" alt="Codaholiq" width="500" />
</p>

<p align="center">
  <strong>GitHub automations powered by Claude Code</strong>
</p>

<p align="center">
  Define triggers. Write prompts. Let AI handle the rest.
</p>

<p align="center">
  <a href="#features">Features</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#how-it-works">How it Works</a> &middot;
  <a href="docs/api.md">API Reference</a> &middot;
  <a href="docs/deployment.md">Deploy</a> &middot;
  <a href="docs/contributing.md">Contributing</a>
</p>

---

## What is Codaholiq?

Codaholiq is a self-hosted platform that lets you create AI-powered automations for your GitHub repositories. Connect your repos, configure triggers (webhooks, cron schedules, or manual dispatch), write prompt templates, and Codaholiq dispatches GitHub Actions workflows that invoke the [Claude Code GitHub Action](https://github.com/anthropics/claude-code-action). Every execution is tracked with real-time log streaming.

## Features

- **Trigger on anything** — GitHub events (push, PR, issues, workflow runs), cron schedules, or manual dispatch
- **Trigger conditions** — filter events with fine-grained conditions using dot-notation payload paths (e.g., only run on pushes to `main`, PRs with a specific label). Supports `equals`, `contains`, `starts_with`, `matches` (regex), and more — combine groups with AND/OR logic
- **Prompt templates** — `{{variable}}` syntax with built-in context variables from event payloads
- **Multi-tenant** — organization-scoped with role-based access control and team management
- **Real-time logs** — SSE-powered live log streaming for every execution
- **GitHub App integration** — automatic repository syncing, installation management, webhook processing

## How it Works

When a GitHub event (push, PR, issue, etc.) arrives, Codaholiq matches it against your configured automations, renders the prompt template with context from the event payload, and dispatches a GitHub Actions workflow running the Claude Code Action. The execution is tracked end-to-end with real-time log streaming back to the dashboard.

### Creating an Automation

**1. Basics** — Name your automation and select a repository.

![Step 1 — Basics](docs/screenshots/create%20automation%201.png)

**2. Trigger** — Choose event types, cron, or manual. Add conditions with AND/OR logic.

![Step 2 — Trigger](docs/screenshots/create%20automation%202.png)

**3. Prompt** — Write your template with `{{variable}}` placeholders from the event payload.

![Step 3 — Prompt](docs/screenshots/create%20automation%203.png)

## Quick Start

### Prerequisites

- [Node.js 22 LTS](https://nodejs.org/)
- [Docker](https://www.docker.com/) & Docker Compose
- A [GitHub App](docs/github-app-setup.md) (for webhook and OAuth features)

### 1. Clone & install

```bash
git clone https://github.com/your-org/codaholiq.git
cd codaholiq
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your GitHub App credentials, JWT secrets, and encryption key. See [`.env.example`](.env.example) for all available options.

### 3. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL 16 and Redis 7 with health checks.

### 4. Run database migrations

```bash
cd apps/api && npx drizzle-kit migrate && cd ../..
```

### 5. Start development servers

```bash
npm run dev
```

The API serves at `http://localhost:3000` and the web app at `http://localhost:5173`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + web concurrently |
| `npm run build` | Build all workspaces |
| `npm test` | Run all tests |
| `npm run lint` | ESLint across all workspaces |
| `npm run typecheck` | TypeScript type checking |
| `npm run format` | Format with Prettier |

### Database commands (from `apps/api/`)

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio GUI |

## Documentation

- [API Reference](docs/api.md) — all endpoints by module
- [GitHub App Setup](docs/github-app-setup.md) — creating and configuring the GitHub App
- [Deployment Guide](docs/deployment.md) — production setup, Docker, migrations
- [Security Model](docs/security.md) — auth, encryption, rate limiting, audit logging
- [Contributing](docs/contributing.md) — dev workflow, testing, code conventions

## Contributing

We welcome contributions. Please read the [Contributing Guide](docs/contributing.md) before submitting a pull request.

```bash
# Run the full check suite before pushing
npm run lint && npm run typecheck && npm test
```

## License

[MIT](LICENSE)
