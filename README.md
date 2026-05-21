# @Zeithrold/Blog

Next.js blog powered by Notion (`react-notion-x` + official Notion API).

## Stack

- **Next.js 16** (App Router, Turbopack)
- **react-notion-x** — article rendering via `notion-compat` + official Notion API record maps
- **@notionhq/client** — post list, tags, metadata (data sources API)
- **Cloudflare Workers** — deploy via `@opennextjs/cloudflare`

## Configuration

Set a single JSON config via environment variable:

| Variable          | Description                           |
| ----------------- | ------------------------------------- |
| `BLOG_CONFIG`     | Plain JSON string (local dev)         |
| `BLOG_CONFIG_B64` | Base64-encoded JSON (production / CI) |

Example JSON:

```json
{
  "notion": {
    "token": "ntn_...",
    "datasourceId": "...",
    "fields": { "tag": "Tag", "draft": "Draft" }
  },
  "site": {
    "name": "@Zeithrold/Blog",
    "description": "Ahead Every Moment"
  }
}
```

Generate config at [/setup](/setup) (disable in production with `SETUP_PAGE_ENABLED=false`).

## Scripts

```bash
pnpm dev          # local development
pnpm build        # Next.js production build
pnpm preview      # OpenNext + Wrangler local preview
pnpm deploy       # Build and deploy to Cloudflare
```

## Routes

| Path          | Description                |
| ------------- | -------------------------- |
| `/`           | Post list                  |
| `/-/[pageId]` | Article (`NotionRenderer`) |
| `/tag/[name]` | Filter by tag              |
| `/setup`      | Config generator           |
| `/api/health` | Health check               |

Legacy `/p/[id]` URLs redirect to `/-/[id]`.

## Deploy secrets

- `BLOG_CONFIG_B64` — blog configuration
- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` — CI deploy
