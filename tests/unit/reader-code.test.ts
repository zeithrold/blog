import assert from 'node:assert/strict'
import { test } from 'node:test'
import { highlightSource } from '@/features/reader/code-tokens'

test('reader highlighting keeps literal markup, tabs, blank lines and original newline sequences', async () => {
  for (const separator of ['\n', '\r\n']) {
    const source = [
      'const journey = true',
      '',
      '\tconsole.log("<script>alert(1)</script>")',
      '',
    ].join(separator)
    const tokens = await highlightSource(source, 'ts')
    assert.ok(tokens !== null)
    assert.ok(tokens.map(token => token.content).join('') === source)
    assert.ok(new Set(tokens.map(token => token.light)).size > 2)
    assert.notDeepEqual(tokens.map(token => token.light), tokens.map(token => token.dark))
    assert.ok(new Set(tokens.map(token => token.offset)).size === tokens.length)
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('reader leaves plain text and unknown code languages readable without highlighting', async () => {
  for (const language of ['text', 'legacy-lang']) {
    assert.equal(await highlightSource('raw <img onerror=alert(1)>', language), null)
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
