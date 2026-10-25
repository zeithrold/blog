import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCodeHighlighter } from '@/content/code-highlighter'

const source = 'const journey = true'
const options = { lang: 'typescript', themes: { light: 'github-light', dark: 'github-dark' } } as const

test('a cold tokenization timeout cannot stretch the first keyword over the entire line', async (t) => {
  const highlighter = await createCodeHighlighter()
  try {
    await highlighter.loadLanguage('typescript')
    const grammar = highlighter.getLanguage('typescript')
    const tokenize = grammar.tokenizeLine2.bind(grammar)
    const stopped: boolean[] = []
    t.mock.method(grammar, 'tokenizeLine2', (...args: Parameters<typeof tokenize>) => {
      const result = tokenize(...args)
      stopped.push(result.stoppedEarly)
      return result
    })
    // TextMate reads the clock at entry and before each scan. Let the first
    // keyword finish, then exhaust the normal 500ms budget; subsequent work is warm.
    let reads = 0
    t.mock.method(Date, 'now', () => ++reads <= 2 ? 0 : 501)
    const tokens = highlighter.codeToTokensWithThemes(source, options).flat()
    assert.equal(tokens.map(token => token.content).join(''), source)
    assert.deepEqual(tokens.map(token => token.variants.light?.color), [
      '#D73A49',
      '#24292E',
      '#005CC5',
      '#24292E',
      '#D73A49',
      '#24292E',
      '#005CC5',
    ])
    const expectedStops = [
      true,
      false,
      false,
    ]
    assert.ok(JSON.stringify(stopped) === JSON.stringify(expectedStops))
  }
  finally {
    highlighter.dispose()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('persistent tokenization timeouts fail instead of returning partial colors or retrying forever', async (t) => {
  const highlighter = await createCodeHighlighter()
  try {
    await highlighter.loadLanguage('typescript')
    const grammar = highlighter.getLanguage('typescript')
    const tokenize = grammar.tokenizeLine2.bind(grammar)
    let attempts = 0
    t.mock.method(grammar, 'tokenizeLine2', (...args: Parameters<typeof tokenize>) => {
      attempts++
      return tokenize(...args)
    })
    let clock = 0
    t.mock.method(Date, 'now', () => clock += 501)
    assert.throws(
      () => highlighter.codeToTokensWithThemes(source, options),
      /Tokenization time limit exceeded/,
    )
    assert.equal(attempts, 2)
  }
  finally {
    highlighter.dispose()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('scope explanations retry the original incoming multiline state without changing colors or source', async (t) => {
  const highlighter = await createCodeHighlighter()
  try {
    await highlighter.loadLanguage('typescript')
    const text = `const value = \`first\nsecond \${true}\``
    const explained = { ...options, includeExplanation: true as const }
    const expected = highlighter.codeToTokensWithThemes(text, explained)
    const grammar = highlighter.getLanguage('typescript')
    const tokenize = grammar.tokenizeLine.bind(grammar)
    const now = Date.now
    let interrupted = false
    let reads = 0
    let simulate = false
    t.mock.method(Date, 'now', () => {
      if (!simulate) {
        return now()
      }
      return ++reads <= 2 ? 0 : 501
    })
    t.mock.method(grammar, 'tokenizeLine', (...args: Parameters<typeof tokenize>) => {
      simulate = !interrupted && args[0].startsWith('second')
      try {
        const result = tokenize(...args)
        interrupted ||= result.stoppedEarly
        return result
      }
      finally {
        simulate = false
      }
    })
    assert.ok(JSON.stringify(highlighter.codeToTokensWithThemes(text, explained)) === JSON.stringify(expected))
    assert.equal(interrupted, true)
  }
  finally {
    highlighter.dispose()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('retry credit is shared across lines rather than renewed for every interrupted line', async (t) => {
  const highlighter = await createCodeHighlighter()
  try {
    await highlighter.loadLanguage('typescript')
    const grammar = highlighter.getLanguage('typescript')
    const tokenize = grammar.tokenizeLine2.bind(grammar)
    const now = Date.now
    const attempted = new Set<string>()
    let simulate = false
    let reads = 0
    let attempts = 0
    t.mock.method(Date, 'now', () => {
      if (!simulate) {
        return now()
      }
      return ++reads <= 2 ? 0 : 501
    })
    t.mock.method(grammar, 'tokenizeLine2', (...args: Parameters<typeof tokenize>) => {
      attempts++
      simulate = !attempted.has(args[0])
      attempted.add(args[0])
      reads = 0
      try {
        return tokenize(...args)
      }
      finally {
        simulate = false
      }
    })
    assert.throws(
      () => highlighter.codeToTokensWithThemes(`${source}\nconst next = false`, options),
      /Tokenization time limit exceeded/,
    )
    assert.equal(attempts, 3)
  }
  finally {
    highlighter.dispose()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
