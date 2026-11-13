---
name: browser-smoke
description: Add, run or revise Blog Playwright browser smoke tests. Use for Notion reading, browser navigation and narrow-screen keyboard/focus checks; not for pure rules, jsdom component tests, Worker API tests or deployment acceptance.
---

# Blog browser smoke

Read README's commands and verification limits, `playwright.config.ts`
and `tests/browser/smoke.spec.ts` before changing this layer.

- Keep this a deliberately incomplete smoke layer: three independent cases,
  Chromium only, one configuration and `pnpm test:browser`. Adding another
  case or browser needs an explicit scope decision, not an automatic matrix.
- Exercise actual routes and react-notion-x output. Assert visible article content
  after navigation, rather than URL equality alone.
- Unit/DOM tests own state combinations; Worker integration owns HTTP, KV,
  publication eligibility and webhook authentication.
- The shared built-Worker host supplies deterministic official Notion API responses
  and real local KV. It never reads production credentials or mutates Notion.
- Browser tests require `pnpm build`. Playwright owns its server, temporary state
  and shutdown; port 8801 is the default and `BLOG_BROWSER_PORT` overrides it.
  Do not reuse an unknown running server or personal development state.
- Keep short helpers in the spec until a concrete need says otherwise.
- Use native Playwright locators, webServer lifecycle and failure traces.
  No fixed sleeps, networkidle readiness, automatic retries, video, mandatory
  screenshots, custom reporters, Page Object hierarchy or test DSL.
- Do not rebuild component/editor harnesses, Worker pools, fixture gateways,
  coverage registries, retirement maps, receipts or evidence validators.
- `pnpm check` includes `pnpm test:browser`; CI installs Chromium before running it
  and uploads native failure traces. Do not add another browser gate or matrix.
  Fixture-driven success does not establish production Notion sharing or webhook delivery,
  OS IME, full accessibility, visual correctness or performance.
- If supporting infrastructure becomes the repeated repair target, stop and
  reduce/reselect the cases rather than adding adapters.

## Origin and validation

The Notion migration replaces the retired CMS journeys while retaining the narrow
Chromium smoke boundary. No third-party Skill text is copied.
Validate frontmatter and referenced paths separately from running the browser
cases; structural checks alone do not establish Skill activation or efficacy.
