# Security Model

## Authentication

### GitHub OAuth Flow

1. User clicks "Login with GitHub" → redirected to GitHub OAuth
2. GitHub redirects back with an authorization code
3. Frontend exchanges the code via `POST /auth/exchange`
4. API returns a short-lived **access token** (JWT, 15 min) and sets an `HttpOnly` **refresh token** cookie (7 days)

### Token Management

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| Access token | 15 min | Client memory (not localStorage) | API authentication via `Authorization: Bearer` header |
| Refresh token | 7 days | `HttpOnly`, `SameSite=Strict` cookie | Silent token renewal |

**Token rotation**: every refresh request issues a new refresh token and revokes the old one. The previous token becomes invalid immediately.

**Reuse detection**: if a revoked refresh token is presented, all tokens for that user are revoked immediately. This detects token theft — if an attacker uses a stolen refresh token after the legitimate user has already refreshed, the entire token family is invalidated.

### Secret Validation

On startup, the API validates:
- `JWT_SECRET` and `JWT_REFRESH_SECRET` are at least 32 characters
- The two secrets are different from each other

The server fails to start if validation fails.

---

## Authorization

### Organization Scoping

Every API route (except auth, health, and public catalogs) is scoped to an organization via `/orgs/:orgId/...`. The **OrgGuard** verifies that the authenticated user is a member of the organization before any controller logic runs.

### Role-Based Access Control

Three roles with configurable permissions per organization:

| Role | Default Permissions |
|------|-------------------|
| **Owner** | All permissions (cannot be restricted) |
| **Admin** | All except `org.members.manage` |
| **Member** | View-only (automations, executions, settings, members, notifications) |

Organization owners can customize admin and member permissions via `PUT /orgs/:orgId/permissions/:role`.

### Permission Enforcement

The **PermissionGuard** checks the `@RequirePermission()` decorator on each endpoint. If the user's effective permissions (based on role + org customization) don't include the required permission, the request is rejected with `403 Forbidden`.

Available permissions:

| Permission | Description |
|------------|-------------|
| `automations.view` | View automations |
| `automations.create` | Create automations |
| `automations.edit` | Edit automations |
| `automations.delete` | Delete automations |
| `automations.toggle` | Enable/disable automations |
| `executions.view` | View executions and logs |
| `executions.retry` | Retry or cancel executions |
| `org.settings.view` | View organization settings |
| `org.settings.edit` | Edit settings, sync repos, manage variables |
| `org.members.view` | View member list |
| `org.members.manage` | Invite/remove members, change roles |
| `notifications.view` | View notifications |
| `notifications.dismiss` | Dismiss notifications |

---

## Webhook Verification

GitHub webhook payloads are verified using **HMAC-SHA256**:

1. GitHub signs the request body with the shared `GITHUB_WEBHOOK_SECRET`
2. The signature is sent in the `X-Hub-Signature-256` header
3. The **WebhooksGuard** computes the expected HMAC and compares using `crypto.timingSafeEqual()` — constant-time comparison prevents timing attacks
4. Requests with invalid or missing signatures are rejected with `401 Unauthorized`

The API uses `rawBody: true` to access the unmodified request body for accurate signature verification.

---

## Input Sanitization

All user inputs are sanitized before processing:

- **HTML stripping**: all HTML tags removed via `sanitize-html`
- **Control characters**: characters 0x00–0x1F, 0x7F, and Unicode directional marks are stripped
- **Template injection detection**: inputs containing `{{`, `${{`, or `${` patterns are flagged
- **Length enforcement**: configurable max length per field (default 1000 characters)

---

## Rate Limiting

Rate limiting is enforced globally via the **ThrottlerGuard** backed by Redis:

| Scope | Default Limit |
|-------|---------------|
| Authenticated requests | 100/min per user |
| Unauthenticated requests | 100/min per IP |
| Auth endpoints | 5/min per IP |
| Auth refresh | 10/min per IP |
| Manual trigger | 10/min per user |
| Read-heavy endpoints | 200/min per user |
| Webhooks | 1000/min |
| SSE log streaming | Exempt |

Rate limit state is stored in Redis for consistency across multiple instances.

Exposed response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

## Security Headers

The API uses [Helmet](https://helmetjs.github.io/) to set security headers:

| Header | Value |
|--------|-------|
| Content-Security-Policy | `default-src 'self'`; no object/frame embedding |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` (production only) |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` (via CSP) |

### CORS

- **Allowed origin**: `FRONTEND_URL` only (required in production)
- **Credentials**: enabled (for cookie transmission)
- **Allowed methods**: GET, POST, PATCH, DELETE, OPTIONS
- **Allowed headers**: Authorization, Content-Type

---

## Secret Masking

The **SecretMaskingService** automatically redacts sensitive data from logs and error messages:

| Pattern | Example |
|---------|---------|
| JWT tokens | `eyJhbGciOiJIUzI1NiI...` |
| Bearer tokens | `Bearer eyJ...` |
| 64-character hex strings | Encryption keys |
| Passwords in URLs | `postgresql://user:***@host` |
| GitHub tokens | `ghp_*`, `ghs_*`, `ghu_*`, `gho_*`, `github_pat_*` |
| Sensitive object keys | `password`, `token`, `secret`, `apikey`, etc. |

All matched values are replaced with `[REDACTED]`. Deep object traversal handles nested structures.

---

## Audit Logging

Security-relevant actions are recorded in the audit log:

| Field | Description |
|-------|-------------|
| `action` | What happened (e.g. `automation.created`, `member.removed`) |
| `userId` | Who performed the action |
| `orgId` | Which organization |
| `resourceType` | Type of resource affected |
| `resourceId` | ID of the affected resource |
| `details` | Request body (sanitized, truncated to 4 KB) |
| `ipAddress` | Client IP |
| `userAgent` | Browser/client identifier (sanitized) |
| `createdAt` | Timestamp |

Audited actions include: automation CRUD, member management, execution cancel/retry, permission changes, and manual triggers.

Audit logs are queryable by organization owners and admins via `GET /orgs/:orgId/audit-logs` with filters for action, user, resource type, and date range.

---

## AI Provider API Key Handling

Codaholiq follows a **zero-trust** approach to AI provider API keys:

- **No storage in Codaholiq**: API keys for AI providers (Anthropic, OpenAI, Google, etc.) are never stored in the Codaholiq database or passed through the Codaholiq API.
- **GitHub-native secret management**: Keys are stored as GitHub repository secrets, managed by the repository owner through GitHub's encrypted secrets infrastructure.
- **Runtime-only access**: The GitHub Actions workflow reads secrets from the repository's secret store at execution time. Codaholiq dispatches the workflow but never sees or handles the API key.
- **Per-repository scoping**: Each repository configures its own API keys, enabling fine-grained control over which teams and repos have access to which AI providers.
- **Secret masking**: The SecretMaskingService redacts any AI provider key patterns that may appear in logs or error messages, as an additional safety layer.

This design means that even if the Codaholiq application or database were compromised, AI provider API keys would not be exposed.

---

## Exception Handling

The global **HttpExceptionFilter** ensures no internal details leak to clients:

- Unhandled exceptions return a generic `500 Internal Server Error` — no stack traces in production
- PostgreSQL unique constraint violations (error 23505) are mapped to `409 Conflict`
- All error details are logged server-side with masked sensitive data
- Client-facing error format: `{ statusCode, error, message, details? }`
