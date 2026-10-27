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

## Public reading design

The public index uses a restrained journal composition: Noto Serif display type, Noto Sans UI, ruled
article rows and real publication metadata. Display type caps at 50px on wide layouts and 36px on
narrow layouts. Secondary public titles share the Serif section scale at 40/32px; recovery and
license titles use 32/26px. Search results follow the same ruled rows as the index, with body-sized
excerpts. Shared body/control/help roles remain 15/13/12px; reading and editable roles remain 17/16px.
Compact UI text retains reachable controls and visible keyboard focus.

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
