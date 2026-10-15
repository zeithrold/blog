import type { StyleSchema } from '@blocknote/core'
import type { ReactCustomInlineContentRenderProps } from '@blocknote/react'
import type { ReactNode } from 'react'
import type * as configs from '@/features/editor/core/rich-config'
import { useBlockNoteEditor } from '@blocknote/react'
import { lazy, Suspense } from 'react'
import { Input, Label } from '@/components/ui/ztd-me/client'
import { BlockSettings } from '@/features/editor/ui/block-settings'
import { useBlogTranslation } from '@/i18n/use-translation'

const MathPreview = lazy(async () => ({ default: (await import('@/features/reader/math')).MathView }))

export function InlineMathView({ inlineContent, updateInlineContent }:
ReactCustomInlineContentRenderProps<typeof configs.inlineMathConfig, StyleSchema>): ReactNode {
  const text = useBlogTranslation('editor').t
  const editor = useBlockNoteEditor()
  return (
    <span contentEditable={false} className="inline-flex max-w-full items-center gap-1 align-middle">
      <Suspense fallback={(
        <span className="animate-pulse text-sm motion-reduce:animate-none">
          {text('loadingFormula')}
        </span>
      )}
      >
        {inlineContent.props.source === ''
          ? <span className="text-sm text-muted-foreground">{text('emptyFormula')}</span>
          : <MathPreview source={inlineContent.props.source} />}
      </Suspense>
      <BlockSettings
        title={text('editFormula')}
        disabled={!editor.isEditable}
        initialOpen={inlineContent.props.source === '' && editor.isFocused()}
      >
        <Label className="grid gap-2">
          {text('formulaSource')}
          <Input
            value={inlineContent.props.source}
            maxLength={4096}
            className="font-mono"
            onChange={(event) => {
              if (editor.isEditable) {
                updateInlineContent({ type: 'inlineMath', props: { source: event.currentTarget.value } })
              }
            }}
          />
        </Label>
        <Suspense fallback={<span>{text('loadingFormula')}</span>}>
          <span aria-label={text('formulaPreview')}><MathPreview source={inlineContent.props.source} /></span>
        </Suspense>
      </BlockSettings>
    </span>
  )
}
