'use client'
import type { CSSProperties, ReactNode } from 'react'
import type { CodeToken } from '@/features/reader/code-tokens'
import { useEffect, useState } from 'react'
import { codeLanguageName, highlightCodeLanguage } from '@/content/code-languages'

const frameClass = [
  'reader-code my-6 min-w-0 overflow-hidden rounded-xl border border-border bg-surface',
  '[&>pre[data-language]]:m-0 [&>pre[data-language]]:rounded-none [&>pre[data-language]]:border-0',
  '[&>pre[data-language]]:bg-transparent [&>pre[data-language]]:px-4 [&>pre[data-language]]:py-4',
].join(' ')

export function CodeBlock({ source, language }: { source: string, language: string }): ReactNode {
  return (
    <div className={frameClass}>
      <div className="border-b border-border px-4 py-2 font-sans text-xs text-muted-foreground">
        {codeLanguageName(language)}
      </div>
      <pre data-language={language} className="overflow-x-auto">
        <Code key={JSON.stringify([language, source])} source={source} language={language} />
      </pre>
    </div>
  )
}

function Code({ source, language }: { source: string, language: string }): ReactNode {
  const [tokens, setTokens] = useState<CodeToken[] | null>(null)
  useEffect(() => {
    if (highlightCodeLanguage(language) === undefined) {
      return
    }
    let current = true
    // The initial, server-rendered source stays readable while local grammars load.
    import('./code-tokens')
      .then(async ({ highlightSource }) => await highlightSource(source, language))
      .then((highlighted) => {
        if (current) {
          setTokens(highlighted)
        }
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [language, source])
  return (
    <code data-language={language} className="font-mono text-inherit">
      {tokens === null ? source : tokens.map(token => <Token key={token.offset} token={token} />)}
    </code>
  )
}

function Token({ token }: { token: CodeToken }): ReactNode {
  const style: CSSProperties & { '--code-light': string, '--code-dark': string } = {
    '--code-light': token.light,
    '--code-dark': token.dark,
  }
  return (
    <span className="reader-code-token [color:var(--code-light)] dark:[color:var(--code-dark)]" style={style}>
      {token.content}
    </span>
  )
}
