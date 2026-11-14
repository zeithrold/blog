import assert from 'node:assert/strict'
import { test } from 'node:test'
import { workerFixture } from '../support/worker/runtime'

function rejected(error: unknown): never {
  throw error instanceof Error ? error : new Error('Test registration failed', { cause: error })
}

test('article Markdown combines the current title and native formatted content', async () => {
  await using worker = await workerFixture()
  const response = await worker.fetch('/posts/reliable-systems.md')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('content-disposition'), 'inline; filename="reliable-systems.md"')
  assert.equal(response.headers.get('link'), '</posts/reliable-systems>; rel="canonical"')
  assert.equal(
    await response.text(),
    `# Reliable systems & small tools

## Designing for recovery

A real Notion paragraph crosses the REST adapter. **Strong evidence.**

- Keep the recovery path observable.

\`\`\`javascript
const recovery = true;
\`\`\`
`,
  )
}).catch(rejected)

test('Markdown HEAD retains the representation headers without a body', async () => {
  await using worker = await workerFixture()
  const response = await worker.fetch('/posts/reliable-systems.md', { method: 'HEAD' })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8')
  assert.equal(await response.text(), '')
}).catch(rejected)

for (const [path, method, status] of [
  [
    '/posts/unreleased-secret.md',
    'GET',
    404,
  ],
  [
    '/posts/absent.md',
    'GET',
    404,
  ],
  [
    '/posts/INVALID.md',
    'GET',
    404,
  ],
  [
    '/posts/reliable-systems.md',
    'POST',
    405,
  ],
] as const) {
  test(`${method} ${path} returns ${status} without exposing article content`, async () => {
    await using worker = await workerFixture()
    const response = await worker.fetch(path, { method })
    assert.equal(response.status, status)
    assert.doesNotMatch(await response.text(), /Unreleased secret|A real Notion paragraph/)
    if (status === 405) {
      assert.equal(response.headers.get('allow'), 'GET, HEAD')
    }
  }).catch(rejected)
}

test('Markdown rechecks publication before using a still-fresh catalog entry', async () => {
  await using worker = await workerFixture()
  assert.equal((await worker.fetch('/posts/reliable-systems.md')).status, 200)
  worker.unpublish()
  const response = await worker.fetch('/posts/reliable-systems.md')
  assert.equal(response.status, 404)
  assert.doesNotMatch(await response.text(), /A real Notion paragraph/)
}).catch(rejected)

for (const markdownMode of [
  'truncated',
  'unknown',
  'malformed',
] as const) {
  test(`${markdownMode} Notion Markdown is rejected instead of serving partial content`, async () => {
    await using worker = await workerFixture({ markdownMode })
    const response = await worker.fetch('/posts/reliable-systems.md')
    assert.equal(response.status, 502)
    const problem: unknown = await response.json()
    assert.ok(typeof problem === 'object' && problem !== null && 'code' in problem)
    assert.equal(problem.code, 'NOTION_CONTENT_INVALID')
  }).catch(rejected)
}
