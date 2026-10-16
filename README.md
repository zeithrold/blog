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
pnpm test:e2e
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
boundaries, sample counts, and performance budgets.

`pnpm test:e2e` runs functional tests in Chromium and WebKit. To select one browser, use
`pnpm exec playwright test --project=chromium`. `pnpm test:integration` runs service integration tests
only; `pnpm test:editor-performance` runs the performance project separately, and
`pnpm test:development` runs development server tests. `pnpm test:a11y` selects the accessibility
scanner cases from the functional suite. CI runs `pnpm check` once, covering static checks, unit
tests, the build, integration tests, both browsers, performance tests, and development server tests.

Tests against the build output reset their disposable Worker and local D1/R2 instances before each
case through an automatic Playwright fixture. The single-worker configuration keeps the reset isolated
from other cases. Production quotas and data constraints remain active. Set `BLOG_TEST_PORT` to choose
an isolated port. Development server tests use the local development database and accept
`BLOG_DEV_TEST_PORT` for the port. Browser screenshots, traces, and reports are written to `blog-tests`
under the operating system's temporary directory. They do not create an `artifacts` directory in the
repository. `pnpm preview` serves the build output and requires a real Access configuration.

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

Preview P95 budgets are 500 ms for the 100- and 500-block scenarios at 1× CPU, 2000 ms for
2000 blocks at 1× CPU, and 750 ms for 500 blocks at 4× CPU. CPU throttling, sample counts,
measurement boundaries, and the other performance budgets remain the same across runs.

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
