import { SyntaxHighlightingExtension } from '@blocknote/core/extensions'

export const codeSyntaxHighlighting = SyntaxHighlightingExtension({
  createHighlighter: async () => await (await import('./code-highlighter')).createCodeHighlighter(),
})
