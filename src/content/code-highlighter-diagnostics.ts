import type { HighlighterCore } from 'shiki/core'

let sequence = 0

function themeSummary(highlighter: HighlighterCore): unknown[] {
  return highlighter.getLoadedThemes().map((name) => {
    const theme = highlighter.getTheme(name)
    return {
      name,
      foreground: theme.fg,
      background: theme.bg,
      ruleCount: theme.settings.length,
      firstRules: theme.settings.slice(0, 2),
      scopes: theme.settings.map(rule => rule.scope),
    }
  })
}

function tokenSummary(token: {
  content: string
  offset: number
  color?: string
  htmlStyle?: unknown
  variants?: unknown
}): unknown {
  // Never log authored text: offsets, lengths and palettes suffice for diagnosis.
  return {
    offset: token.offset,
    length: token.content.length,
    color: token.color,
    htmlStyle: token.htmlStyle,
    variants: token.variants,
  }
}

// Temporary diagnostic-branch instrumentation. No extra tokenization or theme switching.
// Remove before landing; the browser fixture retains these records on success and failure.
export function diagnoseCodeHighlighter<Highlighter extends HighlighterCore>(highlighter: Highlighter): Highlighter {
  const id = ++sequence
  const emit = (record: object): void => {
    console.warn('[blog-shiki-diagnostic]', JSON.stringify({ id, ...record }))
  }
  emit({ phase: 'created', themes: themeSummary(highlighter) })
  const tokenize = highlighter.codeToTokens
  let tokenCalls = 0
  highlighter.codeToTokens = (...args) => {
    const call = ++tokenCalls
    const before = call <= 3 ? themeSummary(highlighter) : undefined
    const result = tokenize(...args)
    if (before !== undefined) {
      emit({
        method: 'codeToTokens',
        call,
        language: args[1].lang,
        sourceLength: args[0].length,
        before,
        after: themeSummary(highlighter),
        tokenCount: result.tokens.flat().length,
        tokens: result.tokens.flat().slice(0, 64).map(tokenSummary),
      })
    }
    return result
  }
  const tokenizeWithThemes = highlighter.codeToTokensWithThemes
  let variantCalls = 0
  highlighter.codeToTokensWithThemes = (...args) => {
    const call = ++variantCalls
    const before = call <= 3 ? themeSummary(highlighter) : undefined
    const result = tokenizeWithThemes(...args)
    if (before !== undefined) {
      emit({
        method: 'codeToTokensWithThemes',
        call,
        language: args[1].lang,
        sourceLength: args[0].length,
        before,
        after: themeSummary(highlighter),
        tokenCount: result.flat().length,
        tokens: result.flat().slice(0, 64).map(tokenSummary),
      })
    }
    return result
  }
  return highlighter
}
