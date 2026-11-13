# Blog

Zeithrold's public blog uses Notion as its content source and keeps the existing site shell.
The Worker reads the official Notion API with `@notionhq/client` 5.31.1, converts supported blocks
to a `notion-types` 8.0.8 record map, and renders the body with `react-notion-x` 8.0.8.
Equations use KaTeX 0.18.4. Editing, media management and publication happen in Notion.
The application has no CMS admin, D1, R2 or Cron runtime.

## Notion content contract

The configured data source is `417c263c-c594-8099-a9f5-000be11373f6`. Share its containing database
and content with the integration used by `NOTION_API_KEY`, granting read access to page properties
and content. An integration token alone does not give access to an unshared source. This is an
integration connection, not a requirement to publish the database on the web.

Keep these exact property names and native Notion types:

| Property | Native type | Meaning |
|----------|-------------|---------|
| `Title` | `title` | Nonempty article or page title |
| `Slug` | `rich_text` | A bare slug such as `hello` becomes `/posts/hello`; full paths are `/posts/hello` or `/pages/about` |
| `Status` | `status` | `Published` is public; `Draft` is not public |
| `PublishedAt` | `date` | Valid publication date used for ordering and feeds |
| `Summary` | `rich_text` | Summary, which may be empty |
| `Tag` | `multi_select` | Native Notion option IDs, names and colors |

Slugs use lowercase ASCII letters, digits and hyphens, begin with a letter or digit, and contain at
most 120 characters after the route prefix. Public paths must be unique. A select or text property
named `Status` does not satisfy the native status contract; neither does text in place of `Tag`.
Only unarchived, untrashed pages directly belonging to the configured data source and having
`Status = Published` are eligible. `PublishedAt` is metadata, not a scheduling mechanism:
the application has no Cron that changes publication status.

Notion page covers supply optional feed and article images. Notion owns the body and media;
there is no second canonical CMS document, revision database, tag catalog or media bucket.
The adapter validates API metadata, pagination and supported blocks rather than silently accepting
incomplete content. Public page links map known Notion page IDs to their blog paths.

## Cache and webhook

`NOTION_CACHE` is a disposable Cloudflare KV cache, not the content store or a backup.
Catalog snapshots remain fresh for at most 60 seconds and page bodies for at most 300 seconds.
Signed media expiry shortens these windows by a 60-second safety margin. Expired entries are
not served as an indefinite stale fallback. Each article request retrieves fresh page metadata
before reusing its body; it rechecks source membership, public status, archive/trash state and
path, and reuses a body only when `last_edited_time` still matches. Catalog lists can remain stale
within their finite window, including while webhook invalidations propagate through KV.
Already loaded pages are not a live publication stream.

Configure a Notion integration webhook at `https://blog.ztd.me/api/notion/webhook`.
Subscribe to page creation, content/property updates, moves, deletion and restoration, plus relevant
data source content/schema and lifecycle events. The handler invalidates the catalog and the
affected page body for `page.*` events whose entity is a page; `data_source.*` events for the
configured source invalidate the catalog. These notifications trigger fresh API reads rather than
supplying replacement content.

The implemented initial verification flow is protected setup mode:

1. Provision a random Worker Secret `NOTION_WEBHOOK_SETUP_TOKEN` of at least 32 characters.
   Setup mode is active only while `NOTION_WEBHOOK_SECRET` is absent or empty.
2. Register the webhook URL with `?setup=<NOTION_WEBHOOK_SETUP_TOKEN>`. The initial POST's
   `verification_token` is stored in KV for 600 seconds.
3. Retrieve it with an authenticated GET to that same URL and setup query token. The response is
   `no-store`; before a challenge arrives or after expiry it returns 404.
4. Use the retrieved token to complete Notion's subscription verification and provision it as the
   Worker Secret `NOTION_WEBHOOK_SECRET`. Remove `NOTION_WEBHOOK_SETUP_TOKEN` and the setup query
   token from the subscription URL. Optionally configure `NOTION_WEBHOOK_SUBSCRIPTION_ID` to
   restrict accepted events to that subscription.

Normal requests must be POSTs with a valid `X-Notion-Signature` HMAC-SHA256 over the raw body,
using the verification token as secret. Setup GETs are unavailable once the normal secret is set.
Keep both secret values out of committed files, static assets, build artifacts and logs.

## Local development

Requires Node 24.21.0 and pnpm 11.22.0. Dependencies stay pinned.
Copy the variable names in `.dev.vars.example` into an ignored `.dev.vars` and supply an integration
key for content you are authorized to read. `wrangler.jsonc` provides the data source ID.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:8800`. Vite provides hot module replacement, uses local KV, disables remote
bindings in development, and sets that exact local `PUBLIC_ORIGIN`. Development still reads the
configured Notion source over the API. There is no local admin login or D1 migration step.
`pnpm preview` uses the built Worker with local bindings and the same local origin.
Pass `--env-file .dev.vars` (or your ignored `.env`) to preview when supplying local credentials
explicitly. The Cloudflare build plugin can generate `dist/server/.dev.vars` for local preview;
this server-only credential file must be excluded from release archives, as the CI artifact rule does.
It is not a browser asset or a production Worker Secret.

## Commands and verification

```sh
pnpm lint
pnpm check:css
pnpm typecheck
pnpm test:unit
pnpm test:dom
pnpm test:browser
pnpm build
pnpm test:integration
pnpm test      # unit, then DOM
pnpm check     # lint, CSS, types, tests, build, integration, browser
```

Unit tests run with Node through `tsx`; DOM tests use Vitest/jsdom. Built-Worker integration tests
require `pnpm build` first and cover the Worker boundary. Browser smoke is the separate real-browser
layer. Integration and browser hosts run the built Worker with real local KV and deterministic
official Notion API responses. The browser server uses port 8801 by default (`BLOG_BROWSER_PORT`
overrides it), owns its temporary state, and refuses to reuse another server. No layer alone proves production Notion
permissions, webhook delivery, KV provisioning, routing, accessibility, OS IME/drag or performance.
Native stdout and the configured browser failure traces are the reporting surfaces; do not rebuild
retired broad harnesses or custom evidence ledgers.

Use `@/*` for application imports, `~/tests/*` across test directories, and relative imports within
one directory. Resolve filesystem resources relative to `import.meta.url`.

## Production configuration and release

Preserve `ASSETS` for `dist/client` and the exact production
`PUBLIC_ORIGIN = https://blog.ztd.me`, with no path or trailing slash. Keep
`NOTION_DATA_SOURCE_ID = 417c263c-c594-8099-a9f5-000be11373f6` and bind a provisioned KV namespace as
`NOTION_CACHE`. Store `NOTION_API_KEY` as a Worker Secret, never a plain Wrangler variable.
Provision `NOTION_WEBHOOK_SECRET`, or temporarily the protected setup token described above.
`NOTION_WEBHOOK_SUBSCRIPTION_ID` is optional. `BUILD_SHA` identifies the release at `/api/health`;
that endpoint is a process/version probe, not proof of Notion or KV readiness.

The source configuration declares the KV binding without a production namespace ID.
The attempted Cloudflare KV namespace list returned authentication error `10000`; it supplies
no evidence that a namespace was provisioned or a deployment succeeded. Content migration to Notion
is complete, but the production source D1 database and R2 bucket have NOT been deleted.
Removing their application bindings does not delete remote resources. No push or deployment has
been authorized for this migration. Retain those resources until a separately authorized retirement.

The `Verify Blog` workflow performs a frozen install and `pnpm check`. A push to `main` follows
Verify then Deploy; pull requests and `codex/**` pushes only verify. CI retains the tested `dist`
and source SHA as `worker-<sha>` for seven days. Deploy checks out that immutable SHA, downloads
that run's tested artifact, checks its source and production bindings, and skips superseded main
revisions. Production deployment is serialized without canceling an active release. It deploys
`dist/server/wrangler.json` without rebuilding or running migrations.

The deployment job requires GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`, and checks for Worker Secret `NOTION_API_KEY` plus either
`NOTION_WEBHOOK_SECRET` or `NOTION_WEBHOOK_SETUP_TOKEN`. A successful name check does not validate
secret values, integration sharing or subscription setup. Post-deploy verification checks that one
matching tagged Worker version receives 100% of traffic through the Cloudflare control plane;
it does not request public pages or establish end-to-end content delivery.

Before an authorized release, verify the intended source's schema/sharing, namespace binding and
secrets, anonymous post/page reads, search/feed/sitemap output, Draft/archive/move eligibility,
signed webhook invalidation, and expiring media behavior. Remote provisioning, deployments and
resource deletion require separate authorization. KV can be discarded and repopulated; content
backup/export and recovery belong to the Notion source and must be rehearsed separately.

## Public reading and source organization

The existing Zeithrold shell retains its journal feed, optional covers, typography, appearance and
language preferences, responsive navigation, explicit pagination and chronological reading order.
Keep reduced-motion behavior and keyboard visibility when changing the staggered feed.
`react-notion-x` renders article bodies inside that shell rather than replacing it with its full-page
header. Code and equation renderers are provided explicitly. Signed media refreshes before expiry
and when a suspended page resumes; cover redirects recheck public metadata.

`src/app` owns routes and ordered global styles; `src/worker` dispatches requests and applies
request/security policy. `src/server/notion` owns official API reads, metadata eligibility, block
conversion, cache and webhooks. `src/server/reader` derives feeds and metadata, and
`src/server/runtime` supplies request bindings and origin checks. `src/contracts/notion.ts` defines
public paths and reader snapshots. `src/features/reader` owns presentation. Browser components
receive snapshots and never the integration key.

Feature CSS remains with its owner and follows `src/app/styles.css` order. The root layout retains
the shared font loading and upstream font notices. `src/i18n` owns the `site` namespace, with an
engine per mounted root or server request and matching English/Chinese resources.
`src/components/ui/ztd-me` keeps its separate upstream source, provider, styling and license
boundary; preserve the original project and foundation notices.

## Build and repository conventions

Do not create a `scripts` directory without explicit permission from the repository owner.
Define routine commands directly in `package.json`. Do not retain new `docs`, `artifacts` or backups.
Do not edit `next-env.d.ts`.

`vite.config.ts` uses native `resolve.tsconfigPaths` for `@/*` and `~/*`, vinext, Tailwind and the
Cloudflare RSC/SSR integration. Vite and TypeScript configuration are strictly type checked;
`skipLibCheck` accommodates published toolchain declaration files. `pnpm build` runs `vite build`
directly without custom license generation.

Original third-party licenses, combined notices and the retained inventory live in the source tree
and `public/licenses`, served as static assets linked from `/licenses`. Regenerate the corresponding
notices and inventory when dependencies change, preserving complete original license text and the
foundation's provenance. The inventory conservatively includes installed production dependencies,
optional dependencies and resolved peers; it is not proof that every package is emitted.
Do not carry forward module counts from an obsolete build as evidence for a new graph.

The shared development Skills remain installed outside this repository. `zt.lock.json` is an empty
retired lock; `zt.json` supports read-only discovery. No project-level Skill sync remains.
