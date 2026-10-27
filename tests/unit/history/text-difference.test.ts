import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changedTextRange } from '@/features/history/text-difference'

test('revision highlighting preserves bilingual text and complete emoji code points', () => {
  const before = '中文段落 🙂 before the ending'
  const after = '中文段落 🚀 after the ending'
  const value = changedTextRange(before, after)
  assert.equal(value.prefix + value.removed + value.suffix, before)
  assert.equal(value.prefix + value.added + value.suffix, after)
  assert.equal(value.prefix, '中文段落 ')
  assert.equal(value.suffix, ' the ending')
}).catch((error: unknown) => { throw error })

test('revision highlighting handles insertion, removal and unchanged large text', () => {
  for (const [before, after] of [
    ['', '新增'],
    ['deleted', ''],
    ['same', 'same'],
    [
      'x'.repeat(64000),
      `${'x'.repeat(64000)}new`,
    ],
  ] as const) {
    const value = changedTextRange(before, after)
    assert.deepEqual({
      before: value.prefix + value.removed + value.suffix,
      after: value.prefix + value.added + value.suffix,
    }, { before, after })
  }
}).catch((error: unknown) => { throw error })
