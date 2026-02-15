# GitHub App Setup

Codaholiq requires a GitHub App for OAuth login, repository access, and webhook delivery. This guide walks through creating and configuring one.

## 1. Create the GitHub App

1. Go to **Settings > Developer settings > GitHub Apps > New GitHub App** ([direct link](https://github.com/settings/apps/new))
2. Fill in the basic info:

| Field | Value |
|-------|-------|
| **GitHub App name** | `Codaholiq` (or any unique name) |
| **Homepage URL** | Your Codaholiq frontend URL |
| **Callback URL** | `https://<your-domain>/api/auth/github/callback` |
| **Setup URL** (optional) | `https://<your-domain>` |
| **Webhook URL** | `https://<your-domain>/api/webhooks/github` |
| **Webhook secret** | A random string (32+ characters). Save this for `.env`. |

> For local development, use a tunnel service (e.g. ngrok, Cloudflare Tunnel) to expose `localhost:3000` to the internet for webhook delivery.

## 2. Set Permissions

Under **Permissions & events**, configure:

### Repository permissions

| Permission | Access |
|------------|--------|
| **Contents** | Read & write |
| **Pull requests** | Read & write |
| **Issues** | Read & write |
| **Actions** | Read & write |
| **Metadata** | Read-only (required, always on) |

### Organization permissions

| Permission | Access |
|------------|--------|
| **Members** | Read-only |

### Account permissions

| Permission | Access |
|------------|--------|
| **Email addresses** | Read-only |

## 3. Subscribe to Events

Codaholiq can handle **any GitHub webhook event** as an automation trigger. Under **Subscribe to events**, select all events that you want to use as automation triggers.

At a minimum, you must subscribe to:

- **Installation and installation target** — required for org creation, repo sync, and installation lifecycle (suspend/unsuspend/delete)
- **Installation repositories** — required to detect when repositories are added to or removed from the installation
- **Workflow run** — required for execution tracking (status updates and log collection when a dispatched workflow completes)

Beyond that, enable any events your automations will use. Common examples include Push, Pull request, Issues, Issue comment, Workflow run, Create/Delete (branch/tag), but the platform supports all GitHub event types. You can always add more events later from the app settings.

## 4. Choose Installation Scope

Under **Where can this GitHub App be installed?**, select:

- **Any account** — if you want others to install the app
- **Only on this account** — for private/internal use

## 5. Create the App

Click **Create GitHub App**. You'll be redirected to the app settings page.

Note the following values from the app settings:

| Value | Where to find it |
|-------|------------------|
| **App ID** | Shown at the top of the app settings page |
| **Client ID** | Under "About" section |
| **Client secret** | Click **Generate a new client secret** (copy immediately, shown only once) |

## 6. Generate a Private Key

1. Scroll to the bottom of the app settings page
2. Click **Generate a private key**
3. A `.pem` file will be downloaded

Convert the private key for use in an environment variable:

```bash
# Option 1: single-line with literal \n (for .env files)
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' your-app.private-key.pem

# Option 2: base64 encode (decode in app startup)
base64 -i your-app.private-key.pem
```

## 7. Configure Environment Variables

Add these to your `.env` file:

```bash
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.abc123def456
GITHUB_CLIENT_SECRET=your_client_secret_here
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
```

## 8. Install the App

1. Go to your GitHub App's public page: `https://github.com/apps/<your-app-name>`
2. Click **Install**
3. Choose which organization or account to install on
4. Select **All repositories** or specific repositories
5. Click **Install**

Codaholiq will automatically receive an `installation.created` webhook, create the organization, and sync the selected repositories.

## 9. Add the Workflow Template

Each repository that Codaholiq automates needs a GitHub Actions workflow file. Add this to every target repository:

```bash
mkdir -p .github/workflows
curl -o .github/workflows/codaholiq.yml \
  https://<your-domain>/api/workflow-template
```

Or copy the file from this repository: [`.github/workflows/codaholiq.yml`](../.github/workflows/codaholiq.yml).

The workflow also requires two repository secrets:

| Secret | Description |
|--------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key for Claude |
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token for Claude Code (optional, for extended capabilities) |

Set these in each repository under **Settings > Secrets and variables > Actions**.

## Troubleshooting

**Webhooks not arriving**
- Verify the webhook URL is publicly reachable
- Check the webhook secret matches `GITHUB_WEBHOOK_SECRET` in `.env`
- Go to your GitHub App settings > **Advanced** to see recent deliveries and error details

**OAuth login fails**
- Verify `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are correct
- Check the callback URL matches your deployment (including `/api/auth/github/callback`)

**Installation not syncing repos**
- Check the API logs for webhook processing errors
- Verify the app has the required permissions
- Try re-installing the app from the GitHub App public page

**"Private key invalid" errors**
- Ensure the key is in PEM format with proper `-----BEGIN/END RSA PRIVATE KEY-----` markers
- If stored in `.env`, ensure `\n` characters are literal (not actual newlines) or quote the value
