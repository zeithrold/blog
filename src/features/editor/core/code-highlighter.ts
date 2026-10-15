import { createBundledHighlighter } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

// Load only a selected grammar, with no WASM or remote code in the browser.
const createHighlighter = createBundledHighlighter({
  langs: {
    bash: async () => await import('shiki/langs/bash.mjs'),
    c: async () => await import('shiki/langs/c.mjs'),
    cpp: async () => await import('shiki/langs/cpp.mjs'),
    csharp: async () => await import('shiki/langs/csharp.mjs'),
    css: async () => await import('shiki/langs/css.mjs'),
    diff: async () => await import('shiki/langs/diff.mjs'),
    dockerfile: async () => await import('shiki/langs/dockerfile.mjs'),
    go: async () => await import('shiki/langs/go.mjs'),
    graphql: async () => await import('shiki/langs/graphql.mjs'),
    html: async () => await import('shiki/langs/html.mjs'),
    java: async () => await import('shiki/langs/java.mjs'),
    javascript: async () => await import('shiki/langs/javascript.mjs'),
    json: async () => await import('shiki/langs/json.mjs'),
    kotlin: async () => await import('shiki/langs/kotlin.mjs'),
    markdown: async () => await import('shiki/langs/markdown.mjs'),
    php: async () => await import('shiki/langs/php.mjs'),
    python: async () => await import('shiki/langs/python.mjs'),
    ruby: async () => await import('shiki/langs/ruby.mjs'),
    rust: async () => await import('shiki/langs/rust.mjs'),
    sql: async () => await import('shiki/langs/sql.mjs'),
    swift: async () => await import('shiki/langs/swift.mjs'),
    typescript: async () => await import('shiki/langs/typescript.mjs'),
    xml: async () => await import('shiki/langs/xml.mjs'),
    yaml: async () => await import('shiki/langs/yaml.mjs'),
  },
  themes: {
    'github-light': async () => await import('shiki/themes/github-light.mjs'),
    'github-dark': async () => await import('shiki/themes/github-dark.mjs'),
  },
  engine: () => createJavaScriptRegexEngine(),
})

export async function createCodeHighlighter(): Promise<Awaited<ReturnType<typeof createHighlighter>>> {
  return await createHighlighter({ themes: ['github-light', 'github-dark'], langs: [] })
}
