# Blog

Zeithrold's public blog uses Notion for content and media, the official Notion API for
server-side reads, and react-notion-x inside the existing site shell. Cloudflare Workers
serve the site; KV holds disposable caches. Editing and publication happen in Notion.

## Development

Use Node 24.21.0 and pnpm 11.22.0. Dependencies are pinned.

1. Copy `.dev.vars.example` to an ignored `.dev.vars` and set `NOTION_API_KEY`.
2. Share the configured Notion database with that integration, including read access to
   properties and content. The data source ID is in `wrangler.jsonc`.
3. Install dependencies and start the local server:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:8800. Development uses local KV and reads the configured Notion
source. Local secrets stay out of version control.

## Content

The database requires these exact property names and native types:

| Property | Type | Purpose |
|----------|------|---------|
| Title | title | Nonempty title |
| Slug | rich_text | Bare slug or full public path |
| Status | status | Published or Draft |
| PublishedAt | date | Publication date and feed order |
| Summary | rich_text | Optional summary text |
| Tag | multi_select | Native option names and colors |

Bare slugs become `/posts/<slug>`; full paths support `/posts/` and `/pages/`.
Use unique lowercase ASCII slugs with letters, digits and hyphens, starting with a
letter or digit and at most 120 characters. Only unarchived, untrashed pages directly
in the configured data source with Status = Published are public. PublishedAt does
not schedule publication. Page covers and body media remain hosted by Notion.

Published posts also expose `/posts/<slug>.md`, combining the title with Notion's
enhanced Markdown. Each request rechecks publication and fetches fresh Markdown;
incomplete upstream responses fail rather than return partial content.
`/tags` lists article counts, and `/tags/<native-tag-id>` aggregates matching published
posts with pagination. Tag links keep their identity when a native label changes.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Local development on port 8800 |
| `pnpm check` | Lint, CSS, types, unit/DOM tests, build, integration and browser smoke |
| `pnpm test` | Unit and DOM tests |
| `pnpm build` | Generate `dist/client` and `dist/server` |
| `pnpm test:integration` | Test the built Worker |
| `pnpm test:browser` | Chromium smoke against the built Worker |
| `pnpm preview` | Preview the built Worker locally on port 8800 |

Integration and browser tests require a build and use real local KV with deterministic
Notion API fixtures. Browser tests own port 8801 by default; `BLOG_BROWSER_PORT` overrides
it. These checks do not prove production permissions, webhook delivery, accessibility,
OS IME behavior or performance.

For preview credentials, pass `--env-file .dev.vars` (or your ignored `.env`). The build
plugin can generate `dist/server/.dev.vars` for local use; release artifacts exclude
that file and other environment files.

## Cache and webhook

Catalog snapshots are fresh for at most 60 seconds and bodies for at most 300 seconds.
Signed media expiry shortens these windows by a 60-second margin. Article requests
recheck current metadata, publication status and path before reusing a body. Lists can
remain stale within their finite cache window, and already loaded pages are not live.

The endpoint is `/api/notion/webhook`. Subscribe to page content/property changes and
lifecycle events, plus relevant data source changes. Signed events invalidate caches;
subsequent reads fetch canonical content from Notion.

For a new subscription:

1. Set a random Worker Secret `NOTION_WEBHOOK_SETUP_TOKEN` of at least 32 characters
   while `NOTION_WEBHOOK_SECRET` is absent.
2. Register `https://blog.ztd.me/api/notion/webhook?setup=<setup-token>` in Notion.
   The initial verification token is stored in KV for 600 seconds.
3. Retrieve it with an authenticated GET to the same URL, complete Notion verification,
   and set it as Worker Secret `NOTION_WEBHOOK_SECRET`.
4. Remove the Worker setup secret. Keep the verified subscription URL unchanged;
   normal mode ignores its setup query and validates `X-Notion-Signature` HMAC-SHA256
   over the raw POST body. `NOTION_WEBHOOK_SUBSCRIPTION_ID` optionally restricts the subscription.

Setup GET responses use no-store. Normal signing mode disables setup access. Keep
credential values out of source, browser assets, release artifacts and logs.

## Deployment

Production configuration lives in `wrangler.jsonc`: `ASSETS`, `NOTION_CACHE`,
`NOTION_DATA_SOURCE_ID` and exact origin `https://blog.ztd.me`. Store `NOTION_API_KEY`
and `NOTION_WEBHOOK_SECRET` as Worker Secrets. `/api/health` reports the release's
`BUILD_SHA`; it does not establish content-source readiness.

The Verify Blog workflow runs a frozen install and `pnpm check`. Main pushes deploy
that run's verified dist and SHA; pull requests and codex branches only verify.
Deployments are serialized, skip superseded main commits, and publish the generated
`dist/server/wrangler.json` without rebuilding. CI requires GitHub Actions secrets
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, plus the Worker secrets above.
It verifies that the tagged version serves 100% of traffic. Public pages, media,
Draft isolation and actual webhook delivery need separate production acceptance.

The application has no CMS admin, D1, R2 or Cron runtime. Original remote D1/R2
resources remain retained; their removal requires separate authorization.

## Source and maintenance

- `src/app`: routes and ordered global styles.
- `src/server/notion`: API reads, public eligibility, block conversion, cache and webhook.
- `src/features/reader`: shell and Notion presentation; browser inputs come from contracts.
- `src/components/ui/ztd-me`: separate foundation source and upstream documentation.
- `public/licenses`: retained notices and dependency inventory, served through `/licenses`.

Use `@/*` for source, `~/tests/*` for tests and relative imports within a directory.
Preserve foundation provenance and original license text; update notices when dependencies
change. Keep feature CSS in `src/app/styles.css` order. Do not edit `next-env.d.ts` or
retain new docs, artifacts, backups or scripts directories without permission.
