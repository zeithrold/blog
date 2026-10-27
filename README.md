# Blog CMS

A BlockNote-based blog CMS with document editing and publishing, private media, tags and series,
scheduled publication, and search.

## Local development

Requires Node 24.21.0 and pnpm 11.22.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:8800/__fixture/login` to sign in to the local admin interface. The development
server uses Vite hot module replacement and applies local D1 migrations on startup. Development login
code lives in `tests/support/development` and is enabled only in development mode; production uses
Cloudflare Access. `pnpm preview` requires a real Access configuration.

## Commands

```sh
pnpm lint
pnpm check:css
pnpm typecheck
pnpm test:unit
pnpm test:dom
pnpm build
pnpm test:integration
pnpm test      # test:unit then test:dom
pnpm check     # lint, css, typecheck, test, build, integration
```

`pnpm test:unit` runs every `tests/unit/**/*.test.ts` with the native Node test runner and its `spec`
reporter. `pnpm test:dom` runs Vitest over `tests/dom`. `pnpm test:integration` starts Miniflare on
the built Worker, so run `pnpm build` first; it is optional and not part of `pnpm test`.

## Test organization

- `tests/unit` holds Node unit tests, grouped by business area (`catalog`, `content`, `documents`,
  `editor`, `history`, `media`, `publication`, `reader`, `references`, `shared`, `components`).
- `tests/dom` runs Vitest in jsdom, grouped into `documents`, `catalog`, `history`, `reader`,
  `media` and `editor`. Domain fixtures stay with their tests; `shared` contains DOM queries,
  HTTP replies and minimal host setup. `vitest.config.ts` is the only test configuration.
  Tests render real components or hooks, with explicit HTTP replies, fixed media preferences,
  no-op resize observation/scrolling and anchor-only links. Catalog tests reject navigation.
  None of these stand-ins proves layout, scrolling or routing.
- `tests/integration` runs the built Worker in Miniflare against local D1 and R2.
- `tests/support/unit` holds assertions and the React server-render fixture; `tests/support/worker`
  holds the Miniflare runtime and response helpers; `tests/support/development` holds the
  development-only login that Vite aliases in.

Use `@/*` for application imports, `~/tests/*` for imports across test directories, and relative
imports within one directory. `~/*` resolves from the repository root through `tsconfig.json`;
filesystem resources use URLs relative to `import.meta.url`. The TypeScript test runner runs directly
through `node --import tsx`.

## Verification limits

Browser coverage was intentionally removed. The Playwright suites, the component bundle harness, the
performance measurements and the development-server checks are gone, along with their configs,
direct dependency and evidence reporters. The CSS-check tool still has a transitive Playwright peer;
it does not install browsers or run browser tests in this project.
DOM tests that reconstructed BlockNote, editor workspaces, route lifecycles or file-upload hosts
were also removed rather than maintained with growing shims. New tests should use ordinary
components/hooks and small boundary fixtures, not rebuild those harnesses.
No check now proves a browser engine, real navigation or
routing, SSR and hydration, viewport and typography behavior, drag or IME handling, accessibility
scanning, or any performance budget. `pnpm test:dom` covers client-side behavior in jsdom only; a
passing `pnpm check` therefore says nothing about those behaviors. Tests report natively to stdout;
there are no screenshots, traces, receipts or run ledgers to retain.

`pnpm check` is the full gate, and CI runs exactly it: the `Verify CMS` workflow performs a frozen install
and then `pnpm check` in one job. Dependency versions stay pinned; the workflow actions stay pinned to
immutable commits.

## Production readiness

The checked-in `wrangler.jsonc` targets Worker `ztd-blog` at `https://blog.ztd.me`, with D1 and
private R2 resources named `ztd-blog`. Confirm the selected Cloudflare account owns these resources
and the `ztd.me` zone before deployment. Keep the binding names `DB`, `MEDIA` and `ASSETS`.
`pnpm dev` still uses local D1/R2; its development-only plugin overrides origin and Access identity.
Configuring a production resource ID does not authorize a remote migration or deployment.
Set `PUBLIC_ORIGIN` to the exact HTTPS origin, with no path or trailing slash. Requests to a different
origin are rejected. Keep the minute Cron trigger: it drives scheduled publication and media cleanup.
Do not expose the R2 bucket through a public bucket URL.

Configure a Cloudflare Access application for both `/admin` and `/admin/*`, and both `/api/admin`
and `/api/admin/*`. Public reading, search, RSS and sitemaps must remain public. Set
`ACCESS_TEAM_DOMAIN` to the team hostname without `https://` and `ACCESS_AUD` to the application's
audience. Admission is controlled by that Access application's policy: every authenticated user
admitted to this application has full CMS admin access. There is no `OWNER_SUBS` allowlist.
The Worker still validates the JWT signature, issuer, audience, expiration, application token type
and nonempty user subject. Merely supplying an Access-looking header does not grant access.
Use identity-based Allow policies, not a Bypass rule or service tokens. Restrict the policy to the
people who should administer the whole blog; the CMS does not provide per-user roles.
The subject remains in audit records and binds CSRF tokens and browser sessions to the signed-in
identity. The existing session response field `ownerSub` carries that identity, not an owner whitelist.
Store a randomly generated `CSRF_SIGNING_SECRET` of at least 32 characters as a Worker Secret;
never commit its value. `.dev.vars.example` documents the variable names, not production credentials.
Leave `ALLOWED_PREVIEW_HOSTS` unset unless a separate Access-protected preview host is required.
Set `BUILD_SHA` to the release commit so `/api/health` identifies the deployed version.

Apply all D1 migrations explicitly to the intended production database before serving traffic;
application startup does not migrate production. Review the generated `dist/server/wrangler.json`
after `pnpm build` and use that generated configuration for deployment, not the source Worker
entry point. `pnpm exec wrangler deploy --dry-run --config dist/server/wrangler.json` checks packaging
without publishing; it does not verify credentials, remote resources, account limits or routing.
Real deployment and remote migrations require separate authorization.

Before release, run `pnpm check` and exercise these paths against the intended environment:

- Anonymous public reading works; missing, forged and wrong-application JWTs cannot access admin routes.
- A policy-admitted user can sign in, save Chinese text, upload media, refresh, preview, publish and unpublish.
- A second policy-admitted user also has admin access, but cannot reuse the first user's CSRF token.
- Draft edits do not change the public article or its homepage presentation.
- A scheduled article publishes and becomes searchable; inspect Cron failures and schedule lag.
- Desktop and narrow-screen reading, keyboard navigation and browser back/forward remain usable.
- Restore a paired database/media backup into an isolated environment and verify it before resuming
  writes. A successful export alone is not recovery evidence.

The health endpoint is a process/version probe, not a D1, R2 or Cron readiness check. Monitor real
public reads, Worker errors, Cron failures, failed schedules, schedule lag and backup age as well.
The operations page exposes storage and schedule status but does not perform an automatic backup.

### Backup and restore contract

Back up database rows and media together. The admin-only backup API uses the normal Access,
same-origin, CSRF and idempotency protections for writes:

1. Call `POST /api/admin/backups/freeze` and retain its `backupId`. The source remains publicly
   readable but writes, scheduled publication and cleanup pause.
2. For each table below, page through
   `GET /api/admin/backups/{backupId}/rows?table={table}&after={cursor}`, starting at `0` and following
   `nextCursor` until it is `null`. Preserve every returned column except the transport `_cursor`.
3. Page through `GET /api/admin/backups/{backupId}/manifest?after={cursor}`, starting with an empty
   cursor. Copy each object to durable backup storage under its original `key`, retaining metadata,
   and verify its byte length and SHA-256 against the manifest. Do not finish the source backup
   until both rows and media are safely retained.
4. Finish on the **source** with `POST /api/admin/backups/finish`, passing `backupId` and the SHA-256
   of the retained manifest. Pass `manifestSha256: null` to mark a failed backup and release its
   maintenance lock. A source backup abandoned after freezing stays paused until explicitly finished.

Restore only into an empty database with all migrations applied, paired with an isolated private
bucket. The insertion order is:

```text
site_state, catalog, assets, documents, revisions, revision_assets, revision_catalog,
published_documents, published_catalog, publication_events, schedules, mutations
```

Import the rows in **one D1 transaction/batch**, beginning with `PRAGMA defer_foreign_keys=ON` to
resolve the documents/revisions reference cycle. Replace the migration-created singleton
`site_state` row; insert other rows normally. Do not split the import into independently committed
statements. Exported `site_state` intentionally starts in ownerless maintenance with `content_bytes=0`;
inserting revisions rebuilds the storage counter, and inserting public projections rebuilds FTS.
Do not import FTS shadow tables, transaction guards, backup runs or backup pins from another instance.

Restore and checksum the media before routing traffic to the new instance. Inspect operations,
article/homepage reads, search, taxonomy, RSS, sitemap, private previews and media. Confirm
`maintenance=1`, `maintenanceOwner=null`, matching content counts and the rebuilt storage counter.
Only after accepting the restored state, call `POST /api/admin/operations/resume` with
`expectedGeneration` from the operations response, or use the operations page's resume action.
Do not call backup `finish` on the restored instance: it does not own the source backup run.

The integration suite exercises this contract with real local D1/R2 bindings and the built Worker.
It is not a production backup scheduler or a general-purpose restore CLI; remote import tooling,
transaction preservation, backup retention and off-account storage still need an operator-owned
rehearsal before release.

## Public reading design

The public index uses a restrained journal composition: Noto Serif display type, Noto Sans UI and
real publication metadata. Articles form a two-column staggered card feed above 701px and a single
column on narrow screens. Optional covers reserve a 3:2 image area; text-only cards are a first-class
variant, not a missing-image placeholder. Cards retain chronological DOM, keyboard and reading order.
A small ResizeObserver-driven grid row span calculation enables the staggered layout; without
JavaScript the server-rendered cards remain readable in an ordinary grid. Pagination remains explicit.
Taxonomy and search retain their compact ruled lists.

On entry, feed cards fade in and rise 8px over 340ms, with a 35ms stagger capped at 175ms.
The animation is CSS-only and runs on the inner card, never on the grid item measured for masonry.
It does not hide content behind a scroll observer, replay on every resize, or require JavaScript.
Reduced-motion preferences disable it, and keyboard-focused cards appear immediately.

Display type caps at 50px on wide layouts and 36px on narrow layouts. Secondary public titles share
the Serif section scale at 40/32px; recovery and license titles use 32/26px. Feed titles use 23/21px.
Shared body/control/help roles remain 15/13/12px; reading and editable roles remain 17/16px.
Compact UI text retains reachable controls and visible keyboard focus.

Tags offer a neutral default and seven named colors in the catalog editor. Their chips reuse the
editor's theme-aware ink palette with a lightly tinted background; color never replaces the label.
Color is captured when a tag is added to a document, like its name and slug. Catalog edits do not
rewrite historical or published snapshots; remove and re-add a draft tag to adopt its current color.
Old documents without a color remain neutral and are not rewritten on read.
Homepage cards show those published tag snapshots below their descriptions, wrapping when needed.
Empty tag rows are omitted; tag chips are non-interactive inside the single article link.
Apply `0003_tag_colors.sql` before deploying the color-aware Worker. The migration adds a column
without altering revisions; retain it on rollback. After any catalog write (including neutral tags
and series), rollback must retain the color-aware catalog response/journal decoder so existing
idempotency keys can replay their saved acknowledgements. After saving colored document snapshots,
also retain a color-aware document decoder. Older strict decoders reject these new fields.

Article covers are chosen or cleared in the editor's metadata settings using the existing image
library. An optional description supplies alt text; an empty description treats the image as
decorative beside its titled link. The canonical `meta.cover` field is optional for older documents.
Covers are normal image references retained by revisions, and homepage covers change only when the
corresponding revision is published. Migration `0004_published_cover.sql` must precede this release.
The new reader accepts old documents, but older strict readers reject revisions containing
`meta.cover` (including `null`). Do not roll back only the Worker to a pre-cover release after new
revisions have been saved: retain a cover-compatible reader or restore a paired pre-release snapshot.
The added columns alone do not make older canonical decoders forward-compatible.

Google font stylesheet imports precede local CSS expansion so both Sans and Serif load before the
bundled declarations. Keep Noto language coverage and the existing font CSP. A declared font family is
not rendering evidence, and the removed browser suites no longer check rendered fonts.

## Source organization

`src/app` owns routes and global style composition; `src/worker` dispatches requests and applies
Worker security. Its HTML response path installs the nonce-bearing history bridge before router
scripts can capture native History methods.

`src/server` groups HTTP handling, authentication, document persistence, media, catalogs, publication,
public reading, reference lookup, operations, and runtime bindings. `src/content` contains
environment-independent document structures, validation, and content rules. `src/contracts` defines
HTTP request/response schemas by business domain; shared response types are inferred from these
schemas. Browser code imports contracts directly instead of server repositories. `src/shared/admin`
owns cross-feature requests, CSRF/idempotency handling, navigation, feedback, confirmation dialogs,
and publication issue labels. `src/components/ui/ztd-me` retains its separate upstream source and
license boundary.

`src/features` groups application behavior. Inside `editor`, `workspace` composes the session and
settings, `engine` integrates BlockNote, and `adapters` implements its component interfaces. Draft
persistence and recovery live in `draft`; blocks, controls, media insertion, references, publication,
and preview keep their views and state together. Editor-specific history integration belongs to the
workspace; `features/history` provides revision loading, comparison, and the standalone history page.
The standalone media gallery remains in `features/media`.

Feature CSS stays with its owner and is imported by `src/app/styles.css` in the established order.
Global CSS stays under `src/app/styles`. Translation resources and phrase mappings use matching
semantic groups, including editor blocks, tables, references, draft state, and preview. Existing
`site`, `editor`, and `documents` namespaces, translation keys, and phrase lookup behavior are
retained.

## Admin feedback

Transient results of explicit user actions use Sonner toasts, emitted only after the operation is
confirmed. Initial rendering, background refresh and draft autosave must not produce success toasts.
Do not turn a persisted property into a toast effect: a loaded article being published is not a new
publication event.

Keep durable publication/save/maintenance badges, validation details, conflicts, recovery choices,
upload progress and other actionable problems in place. A toast does not replace information the
author needs to inspect or resolve. When a transient success message moves to a toast, remove its
inline duplicate rather than shifting the surrounding layout.

## Build and repository conventions

Do not create a `scripts` directory without explicit permission from the repository owner. Define
routine commands directly in `package.json`. Do not retain `docs`, `artifacts`, or backup copies.

`vite.config.ts` uses Vite 8's native `resolve.tsconfigPaths` support to read the `@/*` (source) and
`~/*` (repository root) mappings from `tsconfig.json`, with no additional path resolution plugin. Two
exact module aliases for development login are enabled only in development mode. Vite and TypeScript
configuration are included in strict type checking. `skipLibCheck` skips checks inside declaration
files to accommodate the Cloudflare toolchain's currently published declarations.

`pnpm build` runs `vite build` directly, without custom pre-build or post-build scripts. Original
third-party licenses, combined notices, and the retained dependency inventory snapshot live in the
source tree and `public/licenses`. The public `/licenses` page links to these files, which are
included in the build as static assets. The inventory is not regenerated on each build. Update the
corresponding notices and inventory when adding, removing, or upgrading dependencies.

BlockNote native JSON is the canonical document body. D1 stores revisions, publication state, tags
and series, schedules, and search projections; R2 stores private media. Production deployments and
remote resource changes require separate authorization.

## Shared development Skills

The five generic development Skills (`js-ts-testing`, `ui-foundation`, `ui-web`,
`frontend-engineering`, `frontend-verification`) come from Tools
[`7fd78ba96830452502adbda07575bb250af914ba`](https://github.com/zeithrold/tools/tree/7fd78ba96830452502adbda07575bb250af914ba/skills)
and are installed once for the current user in `~/.agents/skills`; this repository keeps no copy.
`zt.lock.json` stays as an empty retired lock; no project-level Skill sync remains. The root module
declaration in `zt.json` supports read-only discovery.

Where the Skills' verification guidance assumes a browser layer, this repository's removed browser
coverage takes precedence: see the verification limits above.
