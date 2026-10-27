import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCodeHighlighter } from '@/content/code-highlighter'
import { CODE_LANGUAGES, highlightCodeLanguage } from '@/content/code-languages'

test('highlighting resolves known code aliases and leaves legacy/plain languages untouched', () => {
  assert.ok(highlightCodeLanguage('python') === 'python')
  assert.ok(highlightCodeLanguage('py') === 'python')
  assert.ok(highlightCodeLanguage('ts') === 'typescript')
  assert.ok(highlightCodeLanguage('sh') === 'bash')
  assert.ok(highlightCodeLanguage('text') === undefined)
  assert.ok(highlightCodeLanguage('legacy-lang') === undefined)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('the browser regex engine loads supported grammars and preserves source tokens in both themes', async () => {
  const highlighter = await createCodeHighlighter()
  try {
    assert.deepEqual(highlighter.getLoadedLanguages(), [])
    const languages = CODE_LANGUAGES.filter(item => item.value !== 'text').map(item => item.value)
    assert.deepEqual(Object.keys(highlighter.getBundledLanguages()).sort(), languages.toSorted())
    await highlighter.loadLanguage(...languages)
    for (const language of languages) {
      const source = 'value = 42\nprint("<img onerror=alert(1)>")'
      const result = highlighter.codeToTokens(source, { lang: language, theme: 'github-light' })
      assert.ok(result.tokens.map(line => line.map(token => token.content).join('')).join('\n') === source)
    }
    const source = 'def greet(name):\n    return "hello" + name'
    const light = highlighter.codeToTokens(source, { lang: 'python', theme: 'github-light' }).tokens.flat()
    const dark = highlighter.codeToTokens(source, { lang: 'python', theme: 'github-dark' }).tokens.flat()
    assert.ok(new Set(light.map(token => token.color)).size > 2)
    assert.notDeepEqual(light.map(token => token.color), dark.map(token => token.color))
  }
  finally {
    highlighter.dispose()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
