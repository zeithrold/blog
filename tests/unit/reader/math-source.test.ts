import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MathView } from '@/features/reader/math'
import { displayMathSource } from '@/features/reader/math-source'

test('explicit outer display breaks form native MathML rows without changing authored source', () => {
  for (const source of [
    String.raw`x=123\\y=456`,
    String.raw`x=123\newline y=456`,
  ]) {
    assert.ok(displayMathSource(source) === `\\begin{gathered}${source}\n\\end{gathered}`)
    const html = renderToStaticMarkup(createElement(MathView, { source, display: true }))
    assert.equal((html.match(/<mtr>/gu) ?? []).length, 2)
    assert.ok(html.includes('display="block"'))
    assert.ok(!html.includes('math-error'))
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('environments, text groups, escapes, comments and source whitespace keep their TeX meaning', () => {
  const sources = [
    String.raw`\begin{aligned}x&=1\\y&=2\end{aligned}`,
    String.raw`\begin{matrix}1&2\\3&4\end{matrix}`,
    String.raw`\text{a\\b}`,
    String.raw`\text{a\newline b}`,
    String.raw`\verb|a\\b|`,
    String.raw`x=1 % \\ not a formula row`,
    'x=1\n+y',
    String.raw`\{ x \} + y`,
  ]
  for (const source of sources) {
    assert.ok(displayMathSource(source) === source)
  }
  const escapedPercent = String.raw`x=1\%\\y=2`
  assert.ok(displayMathSource(escapedPercent) === `\\begin{gathered}${escapedPercent}\n\\end{gathered}`)
  for (const source of sources.slice(0, 2)) {
    const html = renderToStaticMarkup(createElement(MathView, { source, display: true }))
    assert.equal((html.match(/<mtr>/gu) ?? []).length, 2)
    assert.ok(!html.includes('math-error'))
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('display row support keeps unsafe commands blocked and invalid TeX visible as escaped source', () => {
  for (const source of [
    String.raw`x\\\href{javascript:alert(1)}{bad}`,
    String.raw`x\\\unknown{y}`,
  ]) {
    const html = renderToStaticMarkup(createElement(MathView, { source, display: true }))
    assert.ok(html.includes('math-error'))
    assert.ok(!html.includes('<a'))
    assert.ok(!html.includes('<script'))
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
