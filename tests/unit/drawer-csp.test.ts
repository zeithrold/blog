import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('the drawer loads its audited behavior stylesheet without injecting a style element', () => {
  const css = readFileSync(new URL('../../src/components/ui/ztd-me/styles/drawer.css', import.meta.url), 'utf8')
  assert.ok(css.includes('[data-vaul-drawer]'))
  assert.ok(css.includes('[data-vaul-overlay]'))
  for (const entry of ['index.mjs', 'index.js']) {
    const source = readFileSync(new URL(`../../node_modules/vaul/dist/${entry}`, import.meta.url), 'utf8')
    assert.ok(source.includes('function __insertCSS() {}'))
    assert.ok(!source.includes('document.createElement(\'style\')'))
  }
}).catch((error: unknown) => { throw error })
