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
code lives in `tests/development` and is enabled only in development mode. Production uses Cloudflare
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

`pnpm test:e2e` runs functional tests in Chromium and WebKit. To select one browser, use
`pnpm exec playwright test --project=chromium`. `pnpm test:integration` runs service integration tests
only; `pnpm test:editor-performance` runs the performance project separately, and
`pnpm test:development` runs development server tests. `pnpm test:a11y` selects the accessibility
scanner cases from the functional suite. CI runs `pnpm check` once, covering static checks, unit
tests, the build, integration tests, both browsers, performance tests, and development server tests.

Tests against the build output use disposable local D1/R2 instances. Set `BLOG_TEST_PORT` to choose
an isolated port. Development server tests use the local development database and accept
`BLOG_DEV_TEST_PORT` for the port. Browser screenshots, traces, and reports are written to `blog-tests`
under the operating system's temporary directory. They do not create an `artifacts` directory in the
repository. `pnpm preview` serves the build output and requires a real Access configuration.

## Build and repository conventions

Do not create a `scripts` directory without explicit permission from the repository owner. Backup and
restore commands, the separate release evidence pipeline, and native check CLI wrappers have been
removed. Define routine commands directly in `package.json`. Do not retain `docs`, `artifacts`, or
backup copies.

`vite.config.ts` uses Vite 8's native `resolve.tsconfigPaths` support to read the `@/*` mapping from
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
