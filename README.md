<p align="center">
  <img src="apps/web/public/codaholiq_logo.png" alt="Codaholiq" width="500" />
</p>

<p align="center">
  <strong>AI automations governance platform for GitHub</strong>
</p>

<p align="center">
  Define triggers. Choose your AI provider. Control costs. Ship faster.
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

Codaholiq is an AI automations governance platform for your GitHub repositories. Connect your repos, choose an AI provider — [Claude Code](https://github.com/anthropics/claude-code-action), [OpenAI Codex](https://github.com/openai/codex-action), [Gemini CLI](https://github.com/google-github-actions/run-gemini-cli), or [OpenCode](https://opencode.ai/) with 75+ models — configure triggers (webhooks, cron schedules, or manual dispatch), and write prompt templates. Codaholiq dispatches GitHub Actions workflows to the provider of your choice, tracks every execution with real-time log streaming, and gives you full cost visibility with per-execution token and dollar cost analytics.

## Features

- **Multi-provider support** — run automations with [Claude Code](https://github.com/anthropics/claude-code-action) (Anthropic), [OpenAI Codex](https://github.com/openai/codex-action), [Gemini CLI](https://github.com/google-github-actions/run-gemini-cli) (Google), or [OpenCode](https://opencode.ai/) (75+ models across Anthropic, OpenAI, Google, DeepSeek). Select provider and model per automation.
- **Cost tracking & analytics** — automatic cost extraction from workflow logs, per-execution token counts and dollar costs, dashboard with cost overview (24h/7d/30d), cost-by-provider breakdown, and top costliest automations
- **Trigger on anything** — GitHub events (push, PR, issues, workflow runs), cron schedules, or manual dispatch
- **Trigger conditions** — filter events with fine-grained conditions using dot-notation payload paths (e.g., only run on pushes to `main`, PRs with a specific label). Supports `equals`, `contains`, `starts_with`, `matches` (regex), and more — combine groups with AND/OR logic
- **Prompt templates** — `{{variable}}` syntax with built-in context variables from event payloads
- **Multi-tenant** — organization-scoped with role-based access control and team management
- **Real-time logs** — SSE-powered live log streaming for every execution
- **GitHub App integration** — automatic repository syncing, installation management, webhook processing

## How it Works

When a GitHub event (push, PR, issue, etc.) arrives, Codaholiq matches it against your configured automations, renders the prompt template with context from the event payload, and dispatches a GitHub Actions workflow to your selected AI provider. The execution is tracked end-to-end with real-time log streaming and cost analytics back to the dashboard.

### Creating an Automation

Pick a premade template from the catalog or start from scratch with a custom automation.

![Template catalog](docs/screenshots/create%20automation%200.png)

The catalog includes 27 ready-to-use templates across 7 categories — CI/CD, Code Quality, Security, Dependencies, Project Management, Documentation, and Developer Experience. Select a template, choose a repository, and you're live in seconds.

For full control, choose **Custom Automation** and walk through the step-by-step form:

**1. Basics** — Name your automation and select a repository.

![Step 1 — Basics](docs/screenshots/create%20automation%201.png)

**2. Trigger** — Choose event types, cron, or manual. Add conditions with AND/OR logic.

![Step 2 — Trigger](docs/screenshots/create%20automation%202.png)

**3. Provider & Model** — Choose your AI provider and model. Each provider shows its available models and required repository secrets.

<!-- TODO: add screenshot for provider/model step -->

**4. Prompt** — Write your template with `{{variable}}` placeholders from the event payload.

![Step 4 — Prompt](docs/screenshots/create%20automation%203.png)

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
