import type { ReactCustomBlockRenderProps } from '@blocknote/react'
import type { ReactNode } from 'react'
import type * as configs from '@/features/editor/blocks/rich-config'
import { lazy, Suspense } from 'react'
import { Input, Label } from '@/components/ui/ztd-me/client'
import { SourceBlockView } from '@/features/editor/blocks/source/source-block-view'
import { useRichEditor } from '@/features/editor/engine/use-rich-editor'
import { useBlogTranslation } from '@/i18n/use-translation'

const layout1Class = [
  'block animate-pulse rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground',
  'motion-reduce:animate-none',
].join(' ')
const mathViewClass = [
  '[&_.math-display]:my-0 [&_.bn-preview-with-source-popup]:p-0',
  '[&_.bn-preview-with-source-popup]:min-w-0',
  '[&_.bn-preview-container]:overflow-visible [&_.bn-preview-container]:min-w-0',
].join(' ')

const MathPreview = lazy(async () => ({ default: (await import('@/features/reader/math')).MathView }))
const DiagramPreview = lazy(async () => ({ default: (await import('@/features/reader/diagram')).Diagram }))

function PreviewLoading({ children }: { children: ReactNode }): ReactNode {
  return (
    <span role="status" className={layout1Class}>
      {children}
    </span>
  )
}

export function MathEditorView({ block, contentRef }:
ReactCustomBlockRenderProps<typeof configs.mathConfig>): ReactNode {
  const text = useBlogTranslation('editor').t
  const editor = useRichEditor()
  const source = block.content.map(item => item.text).join('')
  return (
    <SourceBlockView
      editor={editor}
      blockId={block.id}
      label={text('editFormula')}
      className={mathViewClass}
      contentRef={contentRef}
      source={source}
      sourcePlaceholder={text('formulaSource')}
      emptySourcePlaceholder={text('emptyFormula')}
      preview={(
        <Suspense fallback={<PreviewLoading>{text('loadingFormula')}</PreviewLoading>}>
          <span aria-label={text('formulaPreview')} className="block min-w-0">
            <MathPreview source={source} display />
          </span>
        </Suspense>
      )}
    >
      <p className="m-0 text-xs leading-relaxed text-muted-foreground">
        {text('formulaLineBreakHelp')}
        <span className="hidden min-[701px]:inline">
          {' '}
          {text('formulaKeyboardHelp')}
        </span>
      </p>
    </SourceBlockView>
  )
}

export function MermaidView({ block, contentRef }:
ReactCustomBlockRenderProps<typeof configs.mermaidConfig>): ReactNode {
  const text = useBlogTranslation('editor').t
  const editor = useRichEditor()
  const source = block.content.map(item => item.text).join('')
  return (
    <SourceBlockView
      editor={editor}
      blockId={block.id}
      label={text('editDiagram')}
      contentRef={contentRef}
      source={source}
      sourcePlaceholder={text('diagramSource')}
      emptySourcePlaceholder={text('emptyDiagram')}
      preview={(
        <Suspense fallback={<PreviewLoading>{text('loadingDiagram')}</PreviewLoading>}>
          <DiagramPreview source={source} description={block.props.description} autoRender showSource={false} />
        </Suspense>
      )}
    >
      <Label className="grid gap-2">
        {text('diagramDescription')}
        <Input
          value={block.props.description}
          maxLength={500}
          onChange={(event) => {
            if (editor.isEditable) {
              editor.updateBlock(block, { props: { description: event.currentTarget.value } })
            }
          }}
        />
      </Label>
    </SourceBlockView>
  )
}
