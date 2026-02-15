# API Reference

Base URL: `http://localhost:3000` (development) or your production domain.

All protected endpoints require a Bearer token in the `Authorization` header. Org-scoped endpoints (`/orgs/:orgId/...`) also require the authenticated user to be a member of the organization.

## Table of Contents

- [Global Configuration](#global-configuration)
- [Health](#health)
- [Auth](#auth)
- [Organizations](#organizations)
- [Dashboard](#dashboard)
- [Repositories](#repositories)
- [Automations](#automations)
- [Executions](#executions)
- [Webhooks](#webhooks)
- [Permissions](#permissions)
- [Audit Logs](#audit-logs)
- [Notifications](#notifications)
- [Variables](#variables)
- [GitHub Events Catalog](#github-events-catalog)
- [Workflow Template](#workflow-template)

---

## Global Configuration

### Authentication

- **Access token**: JWT, 15-minute expiry. Sent as `Authorization: Bearer <token>`.
- **Refresh token**: 7-day expiry, stored in `HttpOnly` cookie. Rotated on each refresh — the old token is revoked.
- **Reuse detection**: if a revoked refresh token is reused, the entire token family is revoked immediately.

### Rate Limiting

Default: **100 requests per minute** per authenticated user (or per IP for unauthenticated requests). Backed by Redis for distributed consistency.

Custom limits are noted per-endpoint where they differ from the default.

**Rate limit headers** (exposed via CORS):
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

### Response Format

**Success** (single resource):
```json
{ "id": 1, "name": "..." }
```

**Success** (paginated list):
```json
{
  "items": [...],
  "meta": { "total": 42, "limit": 50, "offset": 0 }
}
```

**Error**:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [{ "path": "name", "message": "Required" }]
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `204` | No Content (successful DELETE/PATCH with no body) |
| `400` | Validation error |
| `401` | Missing or invalid token |
| `403` | Not a member of the org, or insufficient permissions |
| `404` | Resource not found |
| `409` | Conflict (unique constraint violation) |
| `429` | Rate limit exceeded |
| `503` | Service unavailable (health check failure) |

---

## Health

Public endpoints for liveness and readiness probes.

### `GET /health`

Returns `200` if the server is running.

```json
{ "status": "ok" }
```

### `GET /health/ready`

Checks database, Redis, and GitHub API connectivity. Returns `200` if all checks pass, `503` if any fail.

```json
{
  "status": "ready",
  "checks": {
    "database": "up",
    "redis": "up",
    "github": "up"
  }
}
```

---

## Auth

All auth endpoints are **public** (no JWT required). Rate limited to **5 requests/minute** unless noted.

### `GET /auth/github`

Redirects the user to GitHub OAuth authorization. Sets an `oauth_state` cookie (10-minute, `HttpOnly`, `SameSite=Lax`) for CSRF protection.

### `GET /auth/github/callback`

GitHub redirects here after authorization. Validates the OAuth state, exchanges the code for tokens, and redirects to the frontend.

### `POST /auth/exchange`

Exchanges a one-time auth code for tokens.

**Body:**
```json
{ "code": "abc123" }
```

**Response** `200`:
```json
{ "accessToken": "eyJ..." }
```

Also sets a `refresh_token` `HttpOnly` cookie (7-day, `SameSite=Strict`).

### `POST /auth/refresh`

Rotates the refresh token and issues a new access token. Rate limited to **10 requests/minute**.

**Body:** empty (reads `refresh_token` from cookie)

**Response** `200`:
```json
{ "accessToken": "eyJ..." }
```

### `POST /auth/logout`

Clears the refresh token cookie and revokes the token family.

**Response** `200`:
```json
{ "message": "Logged out" }
```

---

## Organizations

All endpoints require JWT. Org-scoped endpoints use the `OrgGuard` to verify membership.

### `GET /orgs`

List all organizations the current user belongs to.

**Response** `200`: `Organization[]`

### `GET /orgs/:orgId`

Get organization details.

**Required permission**: org membership

**Response** `200`:
```json
{
  "id": 1,
  "name": "my-org",
  "memberCount": 5,
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### `GET /orgs/:orgId/members`

List all members of an organization.

**Required permission**: `org.members.view`

**Response** `200`:
```json
[
  {
    "userId": 1,
    "username": "octocat",
    "avatarUrl": "https://...",
    "role": "owner",
    "joinedAt": "2025-01-01T00:00:00Z"
  }
]
```

### `POST /orgs/:orgId/members`

Invite a user to the organization.

**Required permission**: `org.members.manage`

**Body:**
```json
{ "username": "octocat", "role": "member" }
```

**Response** `201`: the created member object.

### `PATCH /orgs/:orgId/members/:userId`

Update a member's role.

**Required permission**: `org.members.manage`

**Body:**
```json
{ "role": "admin" }
```

**Response** `204`

### `DELETE /orgs/:orgId/members/:userId`

Remove a member from the organization. The organization owner cannot be removed.

**Required permission**: `org.members.manage`

**Response** `204`

---

## Dashboard

### `GET /orgs/:orgId/dashboard`

Get dashboard statistics for the organization.

**Required permission**: org membership

**Response** `200`: `DashboardStats` (execution counts by status, automation counts, etc.)

---

## Repositories

### `GET /orgs/:orgId/repos`

List repositories accessible to the organization's GitHub App installation.

**Required permission**: `automations.view`

**Query params**: `limit` (default 50), `offset` (default 0), `search`

**Response** `200`:
```json
{
  "items": [
    {
      "id": 1,
      "githubId": 123456,
      "owner": "my-org",
      "name": "my-repo",
      "fullName": "my-org/my-repo",
      "defaultBranch": "main",
      "private": false,
      "language": "TypeScript",
      "archived": false,
      "webhookActive": true
    }
  ],
  "meta": { "total": 10, "limit": 50, "offset": 0 }
}
```

### `GET /orgs/:orgId/repos/:repoId`

Get a single repository with its automation count.

**Required permission**: `automations.view`

**Response** `200`:
```json
{
  "repo": { "id": 1, "fullName": "my-org/my-repo", "..." : "..." },
  "automationCount": 3
}
```

### `POST /orgs/:orgId/repos/sync`

Trigger a background sync of repositories from the GitHub App installation.

**Required permission**: `org.settings.edit`

**Response** `200`:
```json
{ "synced": 12 }
```

### `PATCH /orgs/:orgId/repos/:repoId`

Update repository settings (e.g. enable/disable webhook processing).

**Required permission**: `org.settings.edit`

**Body:**
```json
{ "webhookActive": true }
```

**Response** `200`: the updated repository.

---

## Automations

### `POST /orgs/:orgId/automations`

Create a new automation.

**Required permission**: `automations.create`

**Body:**
```json
{
  "name": "Auto-review PRs",
  "description": "Reviews pull requests using Claude Code",
  "enabled": true,
  "repositoryId": 1,
  "trigger": {
    "type": "event",
    "events": ["pull_request.opened"],
    "conditions": {}
  },
  "template": {
    "prompt": "Review this pull request: {{pull_request.title}}"
  },
  "variables": [
    { "key": "style_guide", "value": "https://...", "source": "static", "required": false }
  ]
}
```

**Response** `201`: the created automation with variables.

### `GET /orgs/:orgId/automations`

List automations for the organization.

**Required permission**: `automations.view` | **Rate limit**: 200/min

**Query params**: `triggerType`, `enabled`, `repoId`, `limit`, `offset`

**Response** `200`: `Automation[]` (flat array, not paginated)

### `GET /orgs/:orgId/automations/:automationId`

Get a single automation with its variables.

**Required permission**: `automations.view` | **Rate limit**: 200/min

**Response** `200`: `AutomationWithVariables`

### `PATCH /orgs/:orgId/automations/:automationId`

Update an automation. All fields are optional.

**Required permission**: `automations.edit`

**Body:** same shape as create, all fields optional.

**Response** `200`: the updated automation.

### `DELETE /orgs/:orgId/automations/:automationId`

Delete an automation and all its variables.

**Required permission**: `automations.delete`

**Response** `204`

### `PATCH /orgs/:orgId/automations/:automationId/enabled`

Toggle an automation's enabled state.

**Required permission**: `automations.toggle`

**Body:**
```json
{ "enabled": false }
```

**Response** `204`

### `POST /orgs/:orgId/automations/:automationId/trigger`

Manually trigger an automation.

**Required permission**: `automations.edit` | **Rate limit**: 10/min

**Body:**
```json
{
  "repositoryId": 1,
  "variables": { "branch": "feature/new" }
}
```

**Response** `200`:
```json
{ "executionId": 42, "status": "pending" }
```

### `POST /orgs/:orgId/automations/:automationId/validate-prompt`

Validate and preview a prompt template without triggering an execution.

**Required permission**: `automations.view`

**Body:**
```json
{
  "prompt": "Fix issue {{issue.number}}: {{issue.title}}",
  "variables": { "issue.number": "123", "issue.title": "Bug" }
}
```

**Response** `200`:
```json
{
  "resolvedPrompt": "Fix issue 123: Bug",
  "variables": ["issue.number", "issue.title"]
}
```

---

## Executions

### `GET /orgs/:orgId/executions/stats`

Get execution count grouped by status.

**Required permission**: `executions.view` | **Rate limit**: 200/min

**Response** `200`:
```json
{
  "byStatus": [
    { "status": "completed", "count": 15 },
    { "status": "failed", "count": 3 }
  ]
}
```

### `GET /orgs/:orgId/executions`

List executions with optional filters.

**Required permission**: `executions.view` | **Rate limit**: 200/min

**Query params**: `automationId`, `status`, `limit` (default 50), `offset` (default 0)

**Response** `200`:
```json
{
  "items": [
    {
      "execution": {
        "id": 1,
        "automationId": 1,
        "status": "completed",
        "resolvedPrompt": "...",
        "githubRunId": 12345,
        "githubRunUrl": "https://github.com/...",
        "startedAt": "...",
        "completedAt": "..."
      },
      "automationName": "Auto-review PRs"
    }
  ],
  "meta": { "total": 42, "limit": 50, "offset": 0 }
}
```

### `GET /orgs/:orgId/executions/:executionId`

Get a single execution with its automation name.

**Required permission**: `executions.view` | **Rate limit**: 200/min

**Response** `200`: `{ execution, automationName }`

### `GET /orgs/:orgId/executions/:executionId/logs`

Get execution logs (paginated).

**Required permission**: `executions.view` | **Rate limit**: 200/min

**Query params**: `after` (cursor), `limit`

**Response** `200`: `ExecutionLog[]`

### `GET /orgs/:orgId/executions/:executionId/logs/stream`

**Server-Sent Events** stream for real-time log delivery.

**Required permission**: `executions.view` | **Rate limit**: exempt

**Event types**:
- `log` — individual log entry (JSON)
- `status` — terminal status update (JSON)
- `heartbeat` — keepalive every 15 seconds

### `POST /orgs/:orgId/executions/:executionId/cancel`

Cancel a running execution.

**Required permission**: `executions.retry`

**Response** `204`

### `POST /orgs/:orgId/executions/:executionId/retry`

Retry a terminal (failed, cancelled, timed out) execution.

**Required permission**: `executions.retry`

**Response** `200`: the new `Execution` object.

---

## Webhooks

### `POST /webhooks/github`

Receives GitHub App webhook events. **Public** (no JWT) — authenticated via HMAC-SHA256 signature verification.

**Rate limit**: 1000/min

**Required headers**:
- `x-hub-signature-256` — HMAC-SHA256 signature of the raw body
- `x-github-event` — event type (e.g. `push`, `pull_request`)
- `x-github-delivery` — unique delivery ID

**Response** `200`:
```json
{ "received": true }
```

Events are queued to BullMQ for async processing.

---

## Permissions

### `GET /orgs/:orgId/permissions/me`

Get the current user's role and effective permissions for this organization.

**Response** `200`:
```json
{
  "role": "admin",
  "permissions": ["automations.view", "automations.create", "..."]
}
```

### `GET /orgs/:orgId/permissions`

Get all role permission mappings. **Owner-only**.

**Response** `200`:
```json
{
  "owner": ["automations.view", "automations.create", "..."],
  "admin": ["automations.view", "..."],
  "member": ["automations.view", "..."]
}
```

### `PUT /orgs/:orgId/permissions/:role`

Update permissions for a role. **Owner-only**.

**Body:**
```json
{ "permissions": ["automations.view", "executions.view"] }
```

**Response** `204`

### Permission Values

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
| `org.settings.edit` | Edit organization settings |
| `org.members.view` | View organization members |
| `org.members.manage` | Invite/remove members, change roles |
| `notifications.view` | View notifications |
| `notifications.dismiss` | Dismiss notifications |

---

## Audit Logs

### `GET /orgs/:orgId/audit-logs`

List audit log entries with optional filters.

**Required permission**: `org.settings.view`

**Query params**: `action`, `userId`, `resourceType`, `from` (ISO date), `to` (ISO date), `limit` (default 50), `offset` (default 0)

**Response** `200`:
```json
{
  "items": [
    {
      "id": 1,
      "orgId": 1,
      "userId": 1,
      "action": "automation.created",
      "resourceType": "automation",
      "resourceId": "5",
      "details": { "name": "Auto-review PRs" },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "meta": { "total": 100, "limit": 50, "offset": 0 }
}
```

---

## Notifications

### `GET /orgs/:orgId/notifications`

List notifications for the current user.

**Required permission**: `notifications.view`

**Query params**: `limit` (default 10)

**Response** `200`: `NotificationDto[]`

### `DELETE /orgs/:orgId/notifications/:notificationId`

Dismiss a notification.

**Required permission**: `notifications.dismiss`

**Response** `204`

---

## Variables

Shared variables that can be referenced across automations in the organization.

### `GET /orgs/:orgId/variables`

List all shared variables.

**Required permission**: `org.settings.view`

**Response** `200`: `SharedVariable[]`

### `POST /orgs/:orgId/variables`

Create a shared variable.

**Required permission**: `org.settings.edit`

**Body:**
```json
{
  "name": "STYLE_GUIDE_URL",
  "description": "Link to the team style guide",
  "value": "https://...",
  "source": "static"
}
```

Variable sources: `static`, `event_payload`.

**Response** `201`: the created variable.

### `PATCH /orgs/:orgId/variables/:variableId`

Update a shared variable. All fields optional.

**Required permission**: `org.settings.edit`

**Response** `200`: the updated variable.

### `DELETE /orgs/:orgId/variables/:variableId`

Delete a shared variable.

**Required permission**: `org.settings.edit`

**Response** `204`

---

## GitHub Events Catalog

### `GET /github-events`

**Public** (no auth required). Returns the catalog of supported GitHub webhook events and their categories.

**Response** `200`:
```json
{
  "categories": [
    { "id": "repository", "label": "Repository" },
    { "id": "pull_request", "label": "Pull Request" }
  ],
  "events": [
    {
      "event": "push",
      "label": "Push",
      "description": "Any push to a repository",
      "category": "repository"
    }
  ]
}
```

---

## Workflow Template

### `GET /workflow-template`

**Public** (no auth required). Returns the GitHub Actions workflow YAML template that users should add to their repositories.

**Response** `200`:
```json
{ "template": "# .github/workflows/codaholiq.yml\nname: Codaholiq\n..." }
```

See [the workflow template file](../.github/workflows/codaholiq.yml) for the full YAML.
