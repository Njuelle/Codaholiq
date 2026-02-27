# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Codaholiq — a platform for defining GitHub repository automations powered by Claude Code. Users configure triggers (GitHub events, cron, manual), write prompt templates, and the platform dispatches GitHub Actions workflows that invoke the Claude Code GitHub Action. Executions are tracked with real-time log streaming.

## Architecture

```
apps/
  api/    # NestJS 11 backend (HTTP + BullMQ processors + Drizzle ORM)
  web/    # React 19 + Vite + Tailwind v4 + shadcn/ui frontend
```

Single NestJS process handles both REST API and BullMQ job processing via `@nestjs/bullmq`. No separate worker. No shared packages — the REST API is the contract between backend and frontend.

### Backend layout (`apps/api/src/`)

```
database/
  database.module.ts          # Drizzle client provider
  drizzle.config.ts           # drizzle-kit config (reads schema.ts barrel)
  migrations/                 # Generated migrations
  schema.ts                   # Barrel re-exporting ALL *.schema.ts from modules
  test/                       # DB test utilities & seed factories
modules/
  auth/                       # GitHub OAuth, JWT, refresh tokens
  organizations/              # Org CRUD, members, dashboard
  webhooks/                   # GitHub webhook receiver + signature guard
  github/                     # GitHub API client, repo sync, installation mgmt
  automations/                # Automation CRUD
    triggers/                 # Event matching, cron scheduling, conditions
    templates/                # Prompt template engine, safety utils
    dto/                      # Automation DTOs
  executions/                 # Execution tracking, BullMQ processors, SSE logs
  permissions/                # Role-based permissions
  audit/                      # Audit logging
  notifications/              # User notifications
  variables/                  # Custom shared variables
  health/                     # Health check endpoint
common/
  guards/                     # jwt-auth, org, permission, throttler
  pipes/                      # zod-validation
  filters/                    # http-exception
  interceptors/               # transform, logging, audit
  decorators/                 # @CurrentUser, @Public, @RequirePermission, @Audit
  crypto/                     # Env validation, secret masking
  sanitization/               # Input sanitization
  logging/                    # Logging module
  monitoring/                 # Job failure tracking
```

Each module owns its Drizzle schema, repository, service, controller, and DTOs. Schemas are co-located in their module (not in a central folder). Large modules may have sub-directories grouping related services (e.g., `automations/triggers/`, `automations/templates/`).

### Frontend layout (`apps/web/src/`)

Domain-driven structure — each domain module owns its pages, components, hooks, types, and lib.

```
modules/                        # Domain modules
  auth/                         # Login, OAuth callback, org selector
  automations/                  # Automation CRUD, forms, trigger config
  executions/                   # Execution list, detail, log viewer
  dashboard/                    # Dashboard stats, charts
  organizations/                # Org settings, members management
  repositories/                 # Repository list, sync
  permissions/                  # Permission management UI
  notifications/                # Notification bell, hooks
  variables/                    # Shared variables management
common/                         # Shared, cross-domain code
  components/
    ui/                         # shadcn/ui primitives (button, input, card, ...)
    layout/                     # App shell, sidebar, top bar
    *.tsx                       # Shared components (page-header, status-badge, ...)
  hooks/                        # Utility hooks (use-clipboard, use-debounce, ...)
  lib/                          # API client, query keys, utils, format
  pages/                        # Error pages (not-found, forbidden, server-error)
  types/                        # Shared API types + barrel re-exporting all module types
test/                           # Test utilities (setup, MSW handlers, factories)
```

**Each domain module follows this internal structure:**
```
modules/<domain>/
  pages/                        # Route-level components
    __tests__/                  # Page tests
  components/                   # Domain-specific UI components
    __tests__/                  # Component tests
    form/                       # Sub-group if needed (e.g., multi-step forms)
      __tests__/
  hooks/                        # Domain hooks (data fetching, mutations)
    __tests__/                  # Hook tests
  lib/                          # Domain-specific utilities (optional)
    __tests__/
  types.ts                      # Domain type definitions
```

## File naming & test conventions

- **Backend files**: NestJS suffix convention — `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.schema.ts`, `*.guard.ts`, `*.pipe.ts`, `*.filter.ts`, `*.interceptor.ts`, `*.processor.ts`, `*.dto.ts`.
- **Backend tests**: `*.spec.ts` in a `__tests__/` subdirectory within the same folder as the source file.
- **Frontend files**: `*.tsx` for components/pages, `*.ts` for hooks/lib/types. One hook per file, named `use-<concern>.ts`.
- **Frontend tests**: `*.test.tsx` / `*.test.ts` in a `__tests__/` subdirectory within the same folder as the source file.
- **Never co-locate tests** next to source files — always place them in the nearest `__tests__/` directory.

## Commands

```bash
# Development
npm run dev                    # Runs api + web concurrently
npm run build                  # Builds api and web

# Testing
npm test                       # All workspace tests
npm test --workspace @codaholiq/api     # API tests only
npm test --workspace @codaholiq/web     # Web tests only
npx vitest run src/modules/auth/        # Single module tests (from apps/api/)

# Linting, types & format
npm run lint                   # ESLint across all workspaces
npm run typecheck              # tsc --noEmit across all workspaces
npm run format                 # format all files across all workspaces


# Database (run from apps/api/)
npm run db:generate            # Generate migration from schema changes
npm run db:migrate             # Apply migrations
npm run db:studio              # Open Drizzle Studio

# Infrastructure
docker compose up -d           # Start Postgres + Redis
```

## Verification (mandatory after every change)

After making any code changes, **always** run typecheck and lint, and fix all errors before considering the task complete:

```bash
npm run typecheck              # Must pass with zero errors
npm run lint                   # Must pass with zero errors — fix all warnings and errors, do not suppress them
npm test                       # All tests must pass across both workspaces
npm run format                 # format all files across all workspaces
```

If any command reports errors, fix them immediately. Do not leave typecheck, lint, or test errors for the user to resolve. Iterate until all three commands pass cleanly.

## Coding standards

### General rules

- **Destructured params** — always use destructured objects for function/method signatures with 2+ params:
  ```typescript
  // GOOD
  async create({ orgId, userId, dto }: { orgId: number; userId: number; dto: CreateAutomationDto }) {}
  // BAD
  async create(orgId: number, userId: number, dto: CreateAutomationDto) {}
  ```
- **Early returns** — guard clauses first, avoid deep nesting:
  ```typescript
  // GOOD
  if (!automation) throw new NotFoundException('Automation not found');
  if (!automation.enabled) throw new BadRequestException('Automation is disabled');
  return this.execute(automation);

  // BAD
  if (automation) {
    if (automation.enabled) {
      return this.execute(automation);
    } else {
      throw new BadRequestException('Automation is disabled');
    }
  } else {
    throw new NotFoundException('Automation not found');
  }
  ```
- **Const over let** — never use `let` when `const` works. No `var` ever.
- **Explicit return types** — all public methods must have explicit return types.
- **No `any`** — use `unknown` + type narrowing when the type is truly unknown. Use generics when the type is parametric.
- **Readonly by default** — use `readonly` on class properties and `Readonly<T>` on params that should not be mutated.
- **Single responsibility** — one class/function does one thing. If a method exceeds ~30 lines, extract helper methods.
- **Meaningful names** — no abbreviations except widely understood ones (`id`, `url`, `dto`). Name booleans as questions: `isEnabled`, `hasAccess`, `canTrigger`.
- **No dead code** — no commented-out code, no unused imports, no unreachable branches.
- **No suppression comments** — never use `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, or `@ts-nocheck`. Fix the root cause instead. Use generics, type narrowing, or restructure code to satisfy both TypeScript and ESLint.

### Backend (NestJS)

**Layered architecture — strict separation:**
- **Controller** — HTTP concerns only: route definition, param extraction, response shaping. No business logic. No direct DB access.
- **Service** — business logic, orchestration, validation. Calls repositories. Never accesses `Request` or `Response` objects.
- **Repository** — data access only. Raw Drizzle queries. No business logic. No HTTP concepts. Returns plain data, not entities with methods.
- **Processor** — BullMQ job handling. Thin wrapper that delegates to services.

**Rules:**
- Controllers call services, never repositories directly.
- Services call repositories, never Drizzle directly.
- Repositories never call other repositories — if a query spans tables, either the service orchestrates or the repository uses joins.
- DTOs validated at controller level with `ZodValidationPipe`. Services receive already-validated data.
- Every public service/repository method has a corresponding test.

**Testing (mandatory):**
- Every module must have functional tests using `supertest` against a real NestJS test app with a test database.
- Repository tests: use the test DB, seed data with factories, verify DB state after operations.
- Service tests: unit tests with mocked repositories. Test business logic, validation, error paths.
- Controller tests: integration tests via `supertest`. Test auth, org scoping, validation errors, response shapes.
- Processor tests: unit tests with mocked services. Verify job routing, retry behavior, error handling.
- Use `describe`/`it` blocks with clear descriptions: `describe('AutomationService.create')`, `it('should reject cron intervals under 5 minutes')`.
- Test file naming: `*.spec.ts` in the `__tests__/` directory of the same folder as the source file.

### Frontend (React)

**Domain-driven organization:**
- **Domain modules** (`src/modules/<domain>/`) — self-contained feature areas. Each module owns its pages, components, hooks, types, and domain-specific lib.
- **Common** (`src/common/`) — shared code used across multiple domains: UI primitives, layout, utility hooks, API client, error pages.

**Separation of concerns within each module:**
- **Pages** (`modules/<domain>/pages/`) — route-level components. Compose layout from smaller components. Minimal logic.
- **Components** (`modules/<domain>/components/`) — small, focused UI units. Receive data via props. No API calls. No global state access.
- **Hooks** (`modules/<domain>/hooks/`) — all stateful logic, API calls, side effects. One hook per concern. Components consume hooks, never `useEffect`/`useState` for API calls directly.
- **Types** (`modules/<domain>/types.ts`) — domain-specific type definitions.
- **Lib** (`modules/<domain>/lib/`) — domain-specific utilities (optional, only when needed).

**Rules:**
- New features go into their domain module. If a feature spans multiple domains, the primary domain owns it and imports from others.
- Shared/reusable code goes in `common/`. If a component or hook is used by 2+ domains, move it to `common/`.
- Domain modules may import from `common/` and from other domain modules' public exports (hooks, types). Avoid deep cross-module component imports.
- Components are pure functions of their props + hook results. No inline fetch calls.
- Hooks encapsulate one concern: `useAutomations()`, `useCreateAutomation()`, `useExecutionLogs()`.
- Every hook is in a dedicated file: `use-automations.ts`, not bundled in a barrel.
- Props interfaces are explicitly typed and exported: `interface AutomationCardProps { ... }`.
- No prop drilling beyond 2 levels — use hooks or context.
- Prefer composition over conditionals: extract `<AutomationEventConfig />`, `<AutomationCronConfig />` instead of `if/else` inside a single component.
- No `any` in event handlers — explicitly type: `(e: React.ChangeEvent<HTMLInputElement>) => void`.
- Import paths use the `@/` alias: `@/modules/automations/hooks/use-automations`, `@/common/components/ui/button`, `@/common/lib/api-client`.

**Testing (mandatory):**
- Every component and hook must have a test file (`*.test.tsx` / `*.test.ts`).
- Use React Testing Library exclusively. Test behavior, not implementation.
- Query by role, label, text — never by test ID unless absolutely necessary.
- Test user interactions: `userEvent.click()`, `userEvent.type()`, not `fireEvent`.
- Mock API calls with MSW (Mock Service Worker), not by mocking fetch/axios.
- Test loading, error, and empty states — not just the happy path.
- Hook tests use `renderHook` from `@testing-library/react`.
- Test file naming: `*.test.tsx` / `*.test.ts` in the `__tests__/` directory of the same folder as the source file.

### Security

- **Never trust client input** — validate everything at the API boundary with Zod schemas. Sanitize before storage.
- **Webhook verification** — always use `timingSafeEqual` for HMAC comparison. Never skip signature checks.
- **No secrets in code** — all secrets via environment variables. Validate presence at startup, fail fast if missing.
- **No secrets in logs** — mask tokens, keys, passwords in all log output. Never log request bodies containing credentials.
- **Parameterized queries only** — no string interpolation in SQL. Drizzle handles this, but verify when writing raw queries.
- **Org-scoped everything** — every query must filter by `orgId`. No endpoint should ever return data from another org. Test this explicitly.
- **Principle of least privilege** — GitHub App requests only the permissions it needs. Installation tokens scoped to the minimum.
- **Rate limit all endpoints** — prevent abuse via `@nestjs/throttler` with Redis store.
- **Short-lived tokens** — access JWT 15min, refresh token 7d with rotation. Reuse detection revokes entire token family.

## Key technical decisions

- **NestJS**: `CommonJS` module, `emitDecoratorMetadata` + `experimentalDecorators`. Builder is `tsc` — do NOT add `typeCheck` to `nest-cli.json` (only works with `swc`).
- **Vitest + NestJS**: esbuild does not emit decorator metadata. ALWAYS use `@Inject(ClassName)` on constructor params, not just the type. Test setup imports `reflect-metadata`.
- **Drizzle ORM**: NEVER mix `db:push` and `db:migrate`. Always use `db:migrate` for schema changes. If state is out of sync, reset with: `docker exec codaholiq-postgres psql -U codaholiq -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"` then re-run `db:migrate`.
- **Drizzle schemas**: Each module owns a `*.schema.ts` file. The barrel `database/schema.ts` re-exports everything for `drizzle-kit`.
- **Drizzle queries**: Use standalone `eq()` import instead of callback-style `where: (t, { eq }) => ...` — the callback style has type conflicts with Node16 module resolution.
- **Web app**: `ESNext` module + `Bundler` moduleResolution. Do NOT use `.tsx` extensions in imports — Vite handles resolution. Tailwind v4 with `@tailwindcss/vite` plugin (no tailwind.config.js).
- **Vite cache**: After changing schema files, clear `apps/web/node_modules/.vite/deps` and restart the dev server. Stale pre-bundled deps cause subtle bugs.
- **shadcn/ui**: Components live in `src/common/components/ui/`. After `npx shadcn@latest add`, verify files land in the correct directory — shadcn may default to `src/components/ui/`. The `components.json` aliases point to `@/common/components`, `@/common/components/ui`, `@/common/lib/utils`, and `@/common/hooks`.
- **Radix UI types**: Always add explicit types for event handler params (e.g., `React.ChangeEvent<HTMLInputElement>`).
- **Test database**: Tests use `codaholiq_test` (via `TEST_DATABASE_URL`), never the dev database. Vitest `globalSetup` auto-creates the test DB and runs migrations before any test. For existing Docker setups: `docker exec codaholiq-postgres psql -U codaholiq -c "CREATE DATABASE codaholiq_test;"` or recreate volumes with `docker compose down -v && docker compose up -d`.

## API design

- All routes org-scoped: `/orgs/:orgId/...`
- Auth: JWT access token (15min) in Authorization header, refresh token (7d) with rotation
- Validation: Zod schemas via `ZodValidationPipe`, DTOs co-located in each module's `dto/` folder
- Responses: `{ data, meta? }` for success, `{ statusCode, error, message, details? }` for errors
- Real-time: SSE for execution log streaming (no WebSocket)
- Async: Webhook processing, cron scheduling, workflow dispatch all via BullMQ queues

