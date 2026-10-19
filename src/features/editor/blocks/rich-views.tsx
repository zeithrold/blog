import type {
  ReactCustomBlockRenderProps,
} from '@blocknote/react'
import type { ReactNode } from 'react'
import type * as configs from '@/features/editor/blocks/rich-config'
import { Callout } from '@/components/ui/callout'
import { calloutLabels, calloutTones } from '@/components/ui/callout-tones'
import { ChoiceSelect } from '@/components/ui/choice-select'
import { EditorText } from '@/i18n/labels'
import { useBlogTranslation } from '@/i18n/use-translation'

const utility1Class = [
  'footnote-definition my-[1.4em] mx-0 py-4 px-5 border border-border rounded-[12px] bg-card',
].join(' ')

const calloutToneClass = [
  'callout-tone w-auto min-h-8 gap-1 rounded-md border-0 bg-transparent px-1.5 py-1',
  'font-medium text-current capitalize hover:bg-muted pointer-coarse:min-h-11',
].join(' ')
const calloutBodyClass = 'callout-body min-h-[1lh] min-w-0 whitespace-pre-wrap leading-[1.7] wrap-anywhere'

export function CalloutView({
  block,
  contentRef,
  editor,
}: ReactCustomBlockRenderProps<typeof configs.calloutConfig>): ReactNode {
  const { t } = useBlogTranslation('editor')
  return (
    <Callout
      tone={block.props.tone}
      header={(
        <ChoiceSelect
          className={calloutToneClass}
          contentEditable={false}
          label={t('calloutTone')}
          value={block.props.tone}
          onValueChange={(tone) => {
            if (
              tone === 'info'
              || tone === 'warning'
              || tone === 'success'
              || tone === 'danger'
            ) {
              editor.updateBlock(block, {
                props: {
                  tone,
                },
              })
            }
          }}
          options={calloutTones.map(tone => ({ value: tone, label: t(calloutLabels[tone]) }))}
        />
      )}
    >
      <div className={calloutBodyClass} ref={contentRef} />
    </Callout>
  )
}
export function FootnoteView({
  contentRef,
}: ReactCustomBlockRenderProps<typeof configs.footnoteConfig>): ReactNode {
  return (
    <aside className={utility1Class}>
      <span contentEditable={false}>
        <EditorText value="Footnote" />
      </span>
      <div ref={contentRef} />
    </aside>
  )
}
export { EmbedView, LinkCardView } from '@/features/editor/blocks/atomic-rich-views'
export { CitationView, FootnoteReferenceView, InlineMathView } from '@/features/editor/blocks/rich-inline-views'
export { MathEditorView, MermaidView } from '@/features/editor/blocks/source/source-rich-views'
export { TocView } from '@/features/editor/blocks/toc-view'
