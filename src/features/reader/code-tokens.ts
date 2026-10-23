import { createCodeHighlighter } from '@/content/code-highlighter'
import { highlightCodeLanguage } from '@/content/code-languages'

export type CodeToken = { content: string, offset: number, light: string, dark: string }

let highlighter: ReturnType<typeof createCodeHighlighter> | undefined

export async function highlightSource(source: string, language: string): Promise<CodeToken[] | null> {
  const lang = highlightCodeLanguage(language)
  if (lang === undefined) {
    return null
  }
  highlighter ??= createCodeHighlighter().catch((error: unknown) => {
    highlighter = undefined
    throw error
  })
  const instance = await highlighter
  await instance.loadLanguage(lang)
  const tokens = instance.codeToTokensWithThemes(source, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
  }).flat()
  const result: CodeToken[] = []
  let end = 0
  for (const token of tokens) {
    if (token.offset > end) {
      result.push({ content: source.slice(end, token.offset), offset: end, light: 'inherit', dark: 'inherit' })
    }
    result.push({
      content: token.content,
      offset: token.offset,
      light: token.variants.light?.color ?? 'inherit',
      dark: token.variants.dark?.color ?? 'inherit',
    })
    end = token.offset + token.content.length
  }
  if (end < source.length) {
    result.push({ content: source.slice(end), offset: end, light: 'inherit', dark: 'inherit' })
  }
  return result
}
