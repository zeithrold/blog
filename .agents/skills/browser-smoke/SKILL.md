---
name: browser-smoke
description: Add, run or revise Blog Playwright browser smoke tests. Use for real editor input, browser navigation and narrow-screen keyboard/focus checks; not for pure rules, jsdom component tests, Worker API tests or deployment acceptance.
---

# Blog browser smoke

Read README's browser smoke and verification limits, `playwright.config.ts`
and `tests/browser/smoke.spec.ts` before changing this layer.

- Keep this a deliberately incomplete smoke layer: three independent cases,
  Chromium only, one configuration and `pnpm test:browser`. Adding another
  case or browser needs an explicit scope decision, not an automatic matrix.
- The navigation case owns the editor's full-document boundary: entry, Back and
  Forward must cross a document boundary (including native BFCache restoration;
  assert a unique per-document marker or
  `request.isNavigationRequest()`, never URL equality alone), and unsaved Back
  must raise the browser's own dialog, dismissed to stay. A clean Back does not
  prove dirty protection. The same case clicks the real desktop View site link:
  save failure stays in the editor, a successful save leaves by document
  navigation, and explicit discard does not raise a second native confirmation.
  Unit/DOM tests own the remaining departure-state combinations.
- Use real routes, BlockNote and local services. Unit/DOM own state combinations;
  Worker integration owns HTTP, persistence and permission semantics.
- Run only in a dedicated checkout with local D1/R2 and no production secrets.
  Browser contexts do not isolate the database. Do not reset personal development
  data or reuse an unknown running server.
- Prepare data separately from navigation. Never open the editor merely to seed
  a list test. Keep short helpers in the spec until a concrete need says otherwise.
- Use native Playwright locators, webServer lifecycle and failure traces.
  No fixed sleeps, networkidle readiness, automatic retries, video, mandatory
  screenshots, custom reporters, Page Object hierarchy or test DSL.
- Do not rebuild component/editor harnesses, Worker pools, fixture gateways,
  coverage registries, retirement maps, receipts or evidence validators.
- `pnpm check` includes `pnpm test:browser`; CI installs Chromium before running it
  and uploads native failure traces. Do not add another browser gate or matrix.
  Dev-server success does not establish built-Worker or production Access behavior,
  OS IME, full accessibility, visual correctness or performance.
- If supporting infrastructure becomes the repeated repair target, stop and
  reduce/reselect the cases rather than adding adapters.

## Origin and validation

Project-owner-approved plan in this conversation, based on the historical threads
“Remove Playwright and flatten Blog test layout”, “分析 Blog 测试编辑器启动瓶颈”,
“阻断 Blog DOM proofgate 候选” and “诊断 History 截图字体等待超时”.
This is newly authored project guidance; no third-party Skill text is copied.
Validate frontmatter and referenced paths separately from running the browser
cases; structural checks alone do not establish Skill activation or efficacy.
