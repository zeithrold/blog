import type { ReactCustomBlockRenderProps } from '@blocknote/react'
import type { ReactNode } from 'react'
import type { nativeCodeBlock } from '@/features/editor/blocks/code/code-block'
import { ChevronDown } from 'lucide-react'
import { CODE_LANGUAGES } from '@/content/code-languages'
import { useRichEditor } from '@/features/editor/engine/use-rich-editor'
import { useBlogTranslation } from '@/i18n/use-translation'

type Props = ReactCustomBlockRenderProps<typeof nativeCodeBlock.config>
const codeViewClass = [
  'w-full min-w-0',
  '[[data-color-scheme=light]_&_.shiki]:[color:var(--shiki-light)]',
  '[[data-color-scheme=dark]_&_.shiki]:[color:var(--shiki-dark)]',
].join(' ')

export function CodeBlockView({ block, contentRef }: Props): ReactNode {
  const editor = useRichEditor()
  const { t } = useBlogTranslation('editor')
  const known = CODE_LANGUAGES.some(item => item.value === block.props.language)
  return (
    <div className={codeViewClass}>
      <div
        contentEditable={false}
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 font-sans"
      >
        <span className="text-xs text-muted-foreground">{t('codeLanguage')}</span>
        <span className="relative inline-flex max-w-40">
          <select
            aria-label={t('codeLanguage')}
            className="code-language-select h-8 w-auto max-w-40 cursor-pointer appearance-none rounded-md
            border border-border bg-surface py-0 ps-2 pe-7 font-sans text-help text-foreground focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-55
            pointer-coarse:min-h-11 pointer-coarse:text-base max-[701px]:min-h-11"
            value={block.props.language}
            disabled={!editor.isEditable}
            onChange={(event) => {
              const language = event.currentTarget.value
              if (editor.isEditable && CODE_LANGUAGES.some(item => item.value === language)) {
                editor.updateBlock(block.id, { props: { language } })
              }
            }}
          >
            {!known && <option value={block.props.language}>{block.props.language}</option>}
            {CODE_LANGUAGES.map(item => (
              <option key={item.value} value={item.value}>
                {item.value === 'text' ? t('plainTextLanguage') : item.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </span>
      </div>
      <pre className="m-0 overflow-x-auto border-t border-border px-4 py-3 font-mono text-sm leading-relaxed">
        <code ref={contentRef} data-language={block.props.language} />
      </pre>
    </div>
  )
}

export function CodeBlockExport({ block, contentRef }: Props): ReactNode {
  return (
    <pre>
      <code ref={contentRef} className={`language-${block.props.language}`} data-language={block.props.language} />
    </pre>
  )
}
