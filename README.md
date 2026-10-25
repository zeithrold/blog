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
code lives in `tests/support/development` and is enabled only in development mode. Production uses Cloudflare
Access.

```sh
pnpm lint
pnpm check:css
pnpm typecheck
pnpm test:unit
pnpm build
pnpm test:integration
pnpm test:ci-plan
pnpm test:core
pnpm test:e2e
pnpm test:journeys
pnpm test:controls
pnpm test:editor-performance
pnpm test:development
```

Playwright has two configurations. `playwright.config.ts` defines Chromium and WebKit functional
projects and a performance project that uses Chromium CDP. `playwright.development.config.ts` starts
the Vite development server to check login, saving, and hot module replacement.

The performance project disables trace and video recording to avoid measurement overhead under CPU
throttling. It retains timing reports and screenshots; functional projects retain failure traces.
Preview actions scope control queries to the header, action menu, and preview dialog. This avoids
repeated whole-editor scans while preserving the interaction flow, accessibility assertions, timing
boundaries and sample counts. Performance budgets are temporarily report-only, as described below.

`pnpm test:e2e` runs functional tests in Chromium and WebKit. To select one browser, use
`pnpm exec playwright test --project=chromium`. `pnpm test:integration` runs service integration tests
only; `pnpm test:editor-performance` runs the performance project separately, and
`pnpm test:development` runs development server tests. `pnpm test:a11y` selects the accessibility
scanner cases from the functional suite. Local `pnpm check` remains the full sequential gate.
`pnpm check:base` owns static checks, unit tests, test-plan validation, the build and integration.

### CI feedback and full verification

`Verify CMS` runs the same required source and runtime checks without making browser failures
prevent unrelated checks from executing:

- **Foundation:** `pnpm check:base`, then package the tested `dist` with its exact source SHA.
- **Core journeys:** `pnpm test:core` runs editing/autosave, publication, private media and the four
  uninterrupted business journeys in both browsers. This intentionally overlaps full coverage for
  earlier feedback; it never replaces any full-suite case.
- **Full browsers:** Chromium and WebKit each run two Playwright shards on four isolated runners.
  Each runner installs dependencies, restores the foundation build after checking its source SHA,
  and owns its own Worker, D1 and R2. `workers: 1` and file-level sharding stay unchanged so neither
  shared resets nor journey steps race. Matrix `fail-fast` is disabled to retain every shard's result.
- **Performance:** all four measured scenarios run independently of browser outcomes. Timing
  budgets remain report-only; correctness and measurement integrity still fail the job.
- **Development:** the real Vite server tests run independently, including when foundation fails.
- **`verify`:** the existing required-check name is retained as an always-run aggregate. Every
  required job must succeed; failure, cancellation or a skipped dependency cannot yield a green gate.

Core, browser and performance jobs require a successful foundation, not each other. Build output is
transferred as a tar archive so hidden manifests survive; it is test input, not deployment approval.
No deployment is added. No test filters, default retries, assertion budgets or supported browsers
are removed. Job deadlines reserve time for evidence uploads. Logs, browser reports, screenshots,
traces and videos are retained for seven days, with separate artifact names for every job/shard.

`pnpm test:ci-plan` uses Playwright's actual `--list` results to assert that the four shards contain
exactly the unsharded dual-browser cases, without omissions or duplicates, keep files intact, and
include the core cases. It discovers tests without starting a browser or Worker. Each shard's
`control-coverage.json` is partial, not an independently complete inventory report; full inventory
enforcement remains `pnpm test:controls` and must not be enabled separately on each shard.

For diagnosis, run:

```sh
pnpm test:diagnose tests/browser/journeys/content.spec.ts --project=webkit --repeat-each=3
```

`Diagnose browser` provides the same selection on a manually chosen
GitHub ref, with an existing spec path (optionally `:line`), one browser and 1/3/10 fresh test
repetitions, not retries. Manual workflow dispatch becomes available once the workflow exists on
the default branch. Its result is diagnostic only and never substitutes for `verify`; it uploads
evidence on success or failure without running unrelated suites or deploying.

Tests against the build output reset their disposable Worker and local D1/R2 instances before each
case through an automatic Playwright fixture. The single-worker configuration keeps the reset isolated
from other cases. Functional cases prebuild at most one fresh spare Worker while the current case runs;
reset swaps instances rather than clearing a shared database. Each instance owns its D1/R2 state,
module state and authentication secrets. This reduces serial reset latency, not total initialization
work, and costs one additional idle Worker. Performance cases retire the spare and disable prewarming
so background initialization cannot contaminate measurements. Set `BLOG_FIXTURE_PREWARM=0` to diagnose
the synchronous path. Build and disposal failures remain failures; shutdown drains accepted work and
reports cleanup errors, including when signals repeat.

Browser readiness uses the application's rendered state rather than whole-page network idle. The
loading-polish fixture separately coordinates already-started, marked route prefetches before deliberate
document unloads, with a bounded deadline and no response replay or page-error exemptions. This avoids
the usual cancellation window; it does not fix the framework's underlying prefetch rejection behavior.

Production quotas and data constraints remain active. Set `BLOG_TEST_PORT` to choose
an isolated port. Development server tests use the local development database and accept
`BLOG_DEV_TEST_PORT` for the port. Browser screenshots, traces, and reports are written to `blog-tests`
under the operating system's temporary directory. They do not create an `artifacts` directory in the
repository. The performance script uses a `performance` subdirectory so its report cannot replace
the functional results during `pnpm check`. `pnpm preview` requires a real Access configuration.

The published `@ztd-me/frontend-checks@0.1.4` helper attaches complete Axe scans and named PNGs
as files rather than embedding ordinary labels in the JSON report. Retain the report together with
its referenced files; exceptionally long labels keep the inline compatibility form. Each run also
writes `test-timings.json` with observed native setup/body/teardown boundaries and explicit unknown
values. These diagnostics do not change assertions, retries or performance-budget enforcement.

## Test organization

`tests/unit` contains Node unit tests; `tests/integration` contains tests against the built Worker.
`tests/browser` groups functional tests by business domain, with editor controls grouped further by
blocks, tables, links, source editing, formatting, overlays, and navigation. Preview, recovery, and
revision history belong to `history`; scheduling belongs to `publication`; media flows belong to
`media`. Cross-feature editor scenarios remain directly under `browser/editor`.

`tests/development` checks the actual Vite server; `tests/performance` owns performance scenarios,
fixtures, and measurements. `tests/support` separates unit rendering/assertions, shared browser
operations, disposable Worker infrastructure, and development-only login support. Scenario-specific
helpers stay with their scenarios. There are no barrel exports or additional test configurations.

`pnpm test:journeys` runs four uninterrupted business tasks plus the presentation journeys in
`tests/browser/journeys`. Each task uses `test.step` boundaries and one disposable database; stages do
not reset the environment. Checkpoints compare an independently maintained expected native document
against the saved API response, capture layouts, and retain fault/step evidence in `journey.json`.
The tasks cover publication and trash, all native content types and media, two-tab conflicts and real
IndexedDB recovery, and scheduled publication plus maintenance recovery. They have no minimum duration.

Presentation journeys use 12 pairwise combinations of Chromium/WebKit, English/Chinese, light/dark,
and 320/390/1440px. They assert readable typography, usable hit targets, focus ownership, scroll-lock
cleanup and overlay bounds. Action menus, previews and reader content are measured before and after
navigation within the same task; unchanged regions must retain their dimensions and computed styles.
They also scan accessibility and reject observed controls missing from the semantic inventory.
On macOS WebKit, keyboard traversal uses Option+Tab/Option+Shift+Tab to include buttons regardless
of the host's Keyboard Navigation preference; the expected focus targets are identical in both browsers.
The selected gesture is recorded in `environment.json` ([Playwright platform behavior](https://github.com/microsoft/playwright/issues/41808)).

There are no persistent PNG baselines or snapshot-update steps. Screenshots, layout measurements,
expected/actual documents and failure traces are diagnostic artifacts in the system temporary directory.
These checks detect explicit layout/interaction regressions, not every possible pixel-level visual change.
The mixed-document fixture checks coexistence and preservation of all schema types; insertion and
per-block settings are exercised by the linked editor suites rather than inferred from fixture rendering.
For an existing remote Playwright browser service, set `BLOG_PLAYWRIGHT_WS_ENDPOINT`; loopback traffic
is forwarded to the local disposable Worker. Presentation contexts permit axe style injection; the four
business tasks retain normal CSP.
Native drag cancellations require recorded detached audio/video clones, matching page/URL/time and
clone counts, and connected healthy original media. Their attribution is retained in `journey.json`;
other resource failures and failed mutations still fail the task.

`pnpm test:controls` runs the full functional suite and requires every inventory contract's linked
suites' applicable cases to pass in both browsers, without retries or skipped evidence. The reporter always writes
`control-coverage.json` with missing contracts, actual test results, revision and source fingerprint;
focused runs explicitly report incomplete coverage. Passing the inventory validates the registered
contracts, not every theoretical input permutation. Set `BLOG_TEST_RUN_ID` to a distinct output folder
name and `BLOG_TEST_PORT` to a distinct port when running independent instances.

Pre-existing physical-touch cases that require Chromium CDP remain listed as platform limitations.
Only their exact annotated WebKit skips may be excluded, and only when the identical Chromium case
passes; all applicable WebKit pointer/keyboard cases must still pass. Other skips fail coverage.

All test modules use TypeScript. Use `@/*` for application imports, `~/tests/*` for imports across test
directories, and relative imports within one directory. `~/*` resolves from the repository root through
`tsconfig.json`; filesystem resources use URLs relative to `import.meta.url`. The TypeScript test
runner and Worker fixture server run directly through `node --import tsx`.

```sh
pnpm test:e2e tests/browser/editor/tables
pnpm test:e2e tests/browser/publication
pnpm test:unit
pnpm test:integration
```

Performance timing budgets are temporarily not enforced while browser correctness is stabilized.
All four scenarios still run with the same CPU throttling, sample counts, measurement boundaries,
saved-content checks and browser-error checks. `performance.json` marks `budgetEnforcement` as
`deferred` and retains measured timings plus the unchanged `referenceBudgets`; a passing run does
not establish performance-budget compliance. Reference preview P95 budgets are 500 ms for the
100- and 500-block scenarios at 1× CPU, 2000 ms for 2000 blocks at 1× CPU, and 750 ms for
500 blocks at 4× CPU. Re-enable timing assertions when performance-budget work resumes.
Virtual-keyboard tracking mounts only on touch devices. Mobile formatting and block-action drawers
mount within their breakpoint so desktop initialization avoids their closed-overlay layout reads.

## Public reading design

The public index uses a restrained journal composition: Noto Serif display type, Noto Sans UI,
ruled article rows and real publication metadata. Display type caps at 50px on wide layouts and
36px on narrow layouts. Secondary public titles share the Serif section scale at 40/32px;
recovery and license titles use 32/26px. Search results follow the same ruled rows as the index,
with body-sized excerpts. Shared body/control/help roles remain 15/13/12px; reading and editable
roles remain 17/16px. Compact UI text retains reachable controls and visible keyboard focus.

Google font stylesheet imports precede local CSS expansion so both Sans and Serif load before
the bundled declarations. Keep Noto language coverage and the existing font CSP. A declared
font family is not rendering evidence; check the loaded and rendered fonts in the browser.
Run-specific screenshots and measurements belong in the system temporary artifacts directory.
Local source, production-build checks and live deployment are separate evidence.

## Shared development Skills

`zt.json` explicitly selects five development Skills from Tools
`7fd78ba96830452502adbda07575bb250af914ba`. Complete directories, references and licenses live under
`.agents/skills`; `zt.lock.json` records their module version and directory hashes.
The root module declaration supports read-only discovery. The native `pnpm check`
command continues to own static checks, build, integration, both browser suites,
performance and development verification.

For UI work, read the public reading design above and the installed
[UI foundation](.agents/skills/ui-foundation/SKILL.md), including its
[eight-dimension visual review](.agents/skills/ui-foundation/references/visual-design.md).
Keep Blog's reading/editor role budgets, content, authentication and native verification
local. The Skills do not own application components or publication policy.

Reproduce or review the managed delivery with the pinned CLI:

```sh
go install github.com/zeithrold/tools/cmd/zt@7fd78ba96830452502adbda07575bb250af914ba
zt sync --root . --plan
zt sync --root .
```

Sync protects unmanaged Skills and local edits; review its plan before applying updates.

## Source organization

`src/app` owns routes and global style composition; `src/worker` dispatches requests and applies
Worker security. Its HTML response path installs the nonce-bearing history bridge before router
scripts can capture native History methods. The built Worker integration test checks that first-script
ordering and JSON/HEAD behavior; custom-policy responses bypass this insertion. `src/server` groups HTTP handling,
authentication, document persistence, media,
catalogs, publication, public reading, reference lookup, operations, and runtime bindings. Repository
inheritance and request behavior are unchanged by this grouping.

`src/content` contains environment-independent document structures, validation, and content rules.
`src/contracts` defines HTTP request/response schemas by business domain; shared response types are
inferred from these schemas. Browser code imports contracts directly instead of server repositories.
`src/shared/admin` owns cross-feature requests, CSRF/idempotency handling, navigation, feedback,
confirmation dialogs, and publication issue labels. `src/components/ui/ztd-me` retains its separate
upstream source and license boundary; application controls and general hooks remain alongside it.

`src/features` groups application behavior. Inside `editor`, `workspace` composes the session and
settings, `engine` integrates BlockNote, and `adapters` implements its component interfaces. Draft
persistence and recovery live in `draft`; blocks, controls, media insertion, references, publication,
and preview keep their views and state together. Editor-specific history integration belongs to the
workspace; `features/history` provides revision loading, comparison, and the standalone history page.
The standalone media gallery remains in `features/media`.

Feature CSS stays with its owner and is imported by `src/app/styles.css` in the established order.
Global CSS stays under `src/app/styles`. Translation resources and phrase mappings use matching
semantic groups, including editor blocks, tables, references, draft state, and preview. Existing
`site`, `editor`, and `documents` namespaces, translation keys, and phrase lookup behavior are retained.

## Build and repository conventions

Do not create a `scripts` directory without explicit permission from the repository owner. Backup and
restore commands, the separate release evidence pipeline, and native check CLI wrappers have been
removed. Define routine commands directly in `package.json`. Do not retain `docs`, `artifacts`, or
backup copies.

`vite.config.ts` uses Vite 8's native `resolve.tsconfigPaths` support to read the `@/*` (source) and `~/*` (repository root) mappings from
`tsconfig.json`, with no additional path resolution plugin. Two exact module aliases for development
login are enabled only in development mode. Vite and Playwright configurations are included in strict
type checking. `skipLibCheck` skips checks inside declaration files to accommodate the Cloudflare
toolchain's currently published declarations.

`pnpm build` runs `vite build` directly, without custom pre-build or post-build scripts. Original
third-party licenses, combined notices, and the retained dependency inventory snapshot live in the
source tree and `public/licenses`. The public `/licenses` page links to these files, which are included
in the build as static assets. The inventory is not regenerated on each build. Update the corresponding
notices and inventory when adding, removing, or upgrading dependencies.

BlockNote native JSON is the canonical document body. D1 stores revisions, publication state, tags
and series, schedules, and search projections; R2 stores private media. Production deployments and
remote resource changes require separate authorization.
