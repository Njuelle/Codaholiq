# Contributing

## Prerequisites

- [Node.js 22 LTS](https://nodejs.org/) (version pinned in `.nvmrc`)
- [Docker](https://www.docker.com/) & Docker Compose
- A [GitHub App](github-app-setup.md) (for webhook and OAuth features)

## Setup

```bash
# Clone and install
git clone https://github.com/your-org/codaholiq.git
cd codaholiq
npm install

# Configure environment
cp .env.example .env
# Edit .env with your GitHub App credentials and secrets

# Start Postgres + Redis
docker compose up -d

# Run database migrations
cd apps/api && npx drizzle-kit migrate && cd ../..

# Start dev servers (API on :3000, web on :5173)
npm run dev
```

## Project Structure

```
apps/
  api/    # NestJS 11 backend (REST API + BullMQ job processing)
  web/    # React 19 + Vite + Tailwind v4 + shadcn/ui frontend
```

npm workspaces monorepo. No shared packages — the REST API is the contract between backend and frontend.

### Backend (`apps/api/src/`)

Layered architecture with strict separation:

- **Controller** — HTTP concerns only (routes, params, response shaping)
- **Service** — business logic and orchestration
- **Repository** — data access via Drizzle ORM
- **Processor** — BullMQ job handling (delegates to services)

Each module (`auth`, `organizations`, `github`, `automations`, `executions`, `webhooks`, `permissions`, `audit`, `notifications`, `variables`) owns its schema, repository, service, controller, and DTOs.

### Frontend (`apps/web/src/`)

Domain-driven structure:

```
modules/<domain>/
  pages/          # Route-level components
  components/     # Domain-specific UI
  hooks/          # Data fetching, mutations, state
  types.ts        # Domain type definitions
common/
  components/ui/  # shadcn/ui primitives
  components/     # Shared components
  hooks/          # Utility hooks
  lib/            # API client, utils
```

## Commands

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + web concurrently |
| `npm run build` | Build all workspaces |
| `npm run lint` | ESLint across all workspaces |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run typecheck` | TypeScript type checking |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |

### Testing

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm test --workspace @codaholiq/api` | API tests only |
| `npm test --workspace @codaholiq/web` | Web tests only |
| `npx vitest run src/modules/auth/` | Single module (from `apps/api/`) |

### Database (from `apps/api/`)

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio GUI |

## Testing

### Backend Tests

- **Framework**: Vitest with `reflect-metadata` setup
- **Test database**: `codaholiq_test` (auto-created by Vitest `globalSetup`)
- **Isolation**: each test runs in a transaction that is rolled back after
- **File naming**: `*.spec.ts` in `__tests__/` subdirectories
- **Coverage thresholds**: 80% lines/functions, 70% branches

What to test:
- **Repository tests**: use real test database, seed with factories, verify DB state
- **Service tests**: unit tests with mocked repositories
- **Controller tests**: integration tests via `supertest` against a NestJS test app
- **Processor tests**: unit tests with mocked services

### Frontend Tests

- **Framework**: Vitest + React Testing Library + jsdom
- **API mocking**: MSW (Mock Service Worker)
- **File naming**: `*.test.tsx` / `*.test.ts` in `__tests__/` subdirectories
- **Coverage thresholds**: 80% lines/functions, 70% branches

Rules:
- Query by role, label, or text — never by test ID unless necessary
- Use `userEvent` for interactions, not `fireEvent`
- Test loading, error, and empty states — not just the happy path
- Hook tests use `renderHook` from `@testing-library/react`

## Code Conventions

### General

- **Destructured params** for functions with 2+ parameters:
  ```typescript
  async create({ orgId, userId, dto }: { orgId: number; userId: number; dto: CreateDto }) {}
  ```
- **Early returns** — guard clauses first, avoid deep nesting
- **`const` over `let`** — never use `let` when `const` works. No `var`.
- **Explicit return types** on all public methods
- **No `any`** — use `unknown` + type narrowing or generics
- **No dead code** — no commented-out code, unused imports, or unreachable branches
- **No suppression comments** — no `eslint-disable`, `@ts-ignore`, `@ts-expect-error`. Fix the root cause.
- **Single responsibility** — if a method exceeds ~30 lines, extract helpers

### Backend

- Controllers never access repositories directly — always go through services
- Services never access `Request`/`Response` objects
- Repositories never call other repositories
- DTOs validated at controller level with `ZodValidationPipe`
- Always use `@Inject(TOKEN)` on constructor params (Vitest/esbuild compatibility)

### Frontend

- Components are pure functions of props + hook results — no inline fetch calls
- One hook per file: `use-automations.ts`, `use-create-automation.ts`
- No prop drilling beyond 2 levels — use hooks or context
- Import paths use the `@/` alias: `@/modules/automations/hooks/use-automations`
- No `.tsx` extensions in imports — Vite handles resolution

## CI Pipeline

The GitHub Actions pipeline runs on every push to `main` and on pull requests:

1. **Lint** — ESLint + Prettier formatting check
2. **Typecheck** — full TypeScript compilation
3. **Security audit** — `npm audit --audit-level=high`
4. **Test** — full test suite with Postgres + Redis services
5. **Build** — production build (requires all above to pass)

### Before Submitting a PR

```bash
npm run lint && npm run typecheck && npm test
```

All three must pass. The CI pipeline will reject PRs that fail any check.

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| NestJS module | `*.module.ts` | `auth.module.ts` |
| Controller | `*.controller.ts` | `auth.controller.ts` |
| Service | `*.service.ts` | `auth.service.ts` |
| Repository | `*.repository.ts` | `auth.repository.ts` |
| Schema | `*.schema.ts` | `auth.schema.ts` |
| Guard | `*.guard.ts` | `jwt-auth.guard.ts` |
| Backend test | `*.spec.ts` | `auth.service.spec.ts` |
| React component | `*.tsx` | `automation-card.tsx` |
| React hook | `use-*.ts` | `use-automations.ts` |
| Frontend test | `*.test.tsx` / `*.test.ts` | `automation-card.test.tsx` |

Tests always go in a `__tests__/` subdirectory of their source folder.
