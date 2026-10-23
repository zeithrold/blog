import { SyntaxHighlightingExtension } from '@blocknote/core/extensions'

export const codeSyntaxHighlighting = SyntaxHighlightingExtension({
  createHighlighter: async () => await (await import('@/content/code-highlighter')).createCodeHighlighter(),
})
