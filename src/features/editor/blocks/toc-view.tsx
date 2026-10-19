import type { ReactCustomBlockRenderProps } from '@blocknote/react'
import type { ReactNode } from 'react'
import type * as configs from '@/features/editor/blocks/rich-config'
import { useEditorState } from '@blocknote/react'
import { Input, Label } from '@/components/ui/ztd-me/client'
import { BlockSettings } from '@/features/editor/blocks/block-settings'
import { contentsHeadings } from '@/features/reader/contents-model'
import { useBlogTranslation } from '@/i18n/use-translation'

const utility1Class = [
  'min-h-9 w-full text-left text-sm text-muted-foreground underline-offset-4',
  'hover:text-foreground',
].join(' ')

const utility2Class = [
  'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
].join(' ')

const layout1Class = [utility1Class, utility2Class].join(' ')

export function TocView({ block, editor }: ReactCustomBlockRenderProps<typeof configs.tocConfig>): ReactNode {
  const text = useBlogTranslation('editor').t
  const headings = useEditorState({ editor, on: 'change', selector: () => contentsHeadings(editor.document) })
  const trimmed = block.props.title.trim()
  const title = trimmed === '' ? text('contentsHeading') : trimmed
  return (
    <nav contentEditable={false} aria-label={title} className="w-full rounded-xl bg-muted/40 p-4 font-sans sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{title}</span>
        <BlockSettings title={text('editContents')} disabled={!editor.isEditable}>
          <Label className="grid gap-2">
            {text('contentsTitle')}
            <Input
              value={block.props.title}
              maxLength={200}
              onChange={(event) => {
                if (editor.isEditable) {
                  editor.updateBlock(block, { props: { title: event.currentTarget.value } })
                }
              }}
            />
          </Label>
        </BlockSettings>
      </div>
      {headings.length === 0
        ? <p className="text-sm text-muted-foreground">{text('contentsEmpty')}</p>
        : (
            <ol className="grid list-none gap-1 p-0">
              {headings.map(heading => (
                <li
                  key={heading.id}
                  data-level={heading.level}
                  className="data-[level=2]:pl-4 data-[level=3]:pl-8"
                >
                  <button
                    type="button"
                    className={layout1Class}
                    onClick={() => {
                      editor.setTextCursorPosition(heading.id)
                      editor.focus()
                      editor.domElement?.querySelector(`[data-id="${heading.id}"]`)
                        ?.scrollIntoView({ block: 'nearest' })
                    }}
                  >
                    {heading.text}
                  </button>
                </li>
              ))}
            </ol>
          )}
    </nav>
  )
}
