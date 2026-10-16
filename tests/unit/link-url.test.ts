import assert from 'node:assert/strict'
import { test } from 'node:test'
import { linkURLLimit, normalizeLinkURL } from '@/features/editor/core/link-url'

test('link destinations retain paths, anchors and explicit protocols while completing bare hosts', () => {
  for (const [input, expected] of [
    ['/posts/entry?x=1#part', '/posts/entry?x=1#part'],
    ['#section', '#section'],
    ['HTTPS://example.com/Path', 'https://example.com/Path'],
    ['mailto:user@example.com', 'mailto:user@example.com'],
    ['example.com/path', 'https://example.com/path'],
    ['httpbin.org/get', 'https://httpbin.org/get'],
    ['example.com:8443/path', 'https://example.com:8443/path'],
    ['localhost:8080/path', 'https://localhost:8080/path'],
    [' https://example.com/path ', 'https://example.com/path'],
  ]) {
    assert.equal(normalizeLinkURL(input ?? ''), expected)
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('unsupported and malformed link destinations fail before mutation', () => {
  for (const value of [
    '',
    '  ',
    '//elsewhere.example/path',
    'ftp://example.com',
    'javascript://example.com',
    'data:text/html,test',
    'https://exa mple.com',
    'https://user:password@example.com',
    'https://example.com/encoded%0aheader',
    'https://example.com/back\\slash',
  ]) {
    assert.equal(normalizeLinkURL(value), null, value)
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('the stored destination limit includes the completed protocol', () => {
  const prefix = 'example.com/'
  const bare = prefix + 'a'.repeat(linkURLLimit - 'https://'.length - prefix.length)
  assert.equal(normalizeLinkURL(bare)?.length, linkURLLimit)
  assert.equal(normalizeLinkURL(`${bare}a`), null)
  assert.equal(normalizeLinkURL(`https://${bare}`)?.length, linkURLLimit)
  assert.equal(normalizeLinkURL(`https://${bare}a`), null)
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
