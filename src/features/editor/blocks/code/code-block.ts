import { createCodeBlockSpec } from '@blocknote/core'
import { createReactBlockSpec } from '@blocknote/react'
import { CODE_LANGUAGES, highlightCodeLanguage } from '@/content/code-languages'
import { CodeBlockExport, CodeBlockView } from '@/features/editor/blocks/code/code-block-view'

// Keep native plain-text parsing, metadata and keyboard shortcuts; replace only its view.
export const nativeCodeBlock = createCodeBlockSpec({
  supportedLanguages: Object.fromEntries(CODE_LANGUAGES.map(language => [
    language.value,
    {
      name: language.name,
      ...('aliases' in language ? { aliases: Array.from(language.aliases) } : {}),
    },
  ])),
})

export const codeBlock = createReactBlockSpec(nativeCodeBlock.config, {
  meta: {
    ...nativeCodeBlock.implementation.meta,
    highlight: block => highlightCodeLanguage(block.props.language),
  },
  parse: nativeCodeBlock.implementation.parse,
  parseContent: nativeCodeBlock.implementation.parseContent,
  render: CodeBlockView,
  toExternalHTML: CodeBlockExport,
}, nativeCodeBlock.extensions)()
