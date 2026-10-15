import type { StyleSchema } from '@blocknote/core'
import type { ReactCustomInlineContentRenderProps } from '@blocknote/react'
import type { ReactNode } from 'react'
import type * as configs from '@/features/editor/core/rich-config'
import { use, useId, useState } from 'react'
import { ChoiceSelect } from '@/components/ui/choice-select'
import { Input, Label } from '@/components/ui/ztd-me/client'
import { matchingReferences } from '@/features/editor/core/citation-search'
import { RichMetadataContext } from '@/features/editor/core/rich-context'
import { useBlogTranslation } from '@/i18n/use-translation'

const utility1Class = [
  'citation-editor inline-flex flex-wrap items-center max-w-full gap-[6px]',
  '[vertical-align:middle]',
].join(' ')

const utility2Class = [
  '[&_>_.ztd-select]:flex-[1_1_160px] [&_>_.ztd-select]:w-40 [&_>_.ztd-select]:max-w-full',
].join(' ')

const utility3Class = ['[&_>_.ztd-input]:flex-[0_1_96px] [&_>_.ztd-input]:w-24 [&_>_.ztd-input]:max-w-full'].join(' ')

const utility4Class = [
  'visually-hidden absolute w-px h-px m-[-1px] p-0 overflow-hidden [clip-path:inset(50%)]',
].join(' ')

const layout1Class = [
  utility1Class,
  utility2Class,
  utility3Class,
].join(' ')

const layout2Class = [utility4Class, 'whitespace-nowrap border-0'].join(' ')

export function CitationView({
  inlineContent,
  updateInlineContent,
}: ReactCustomInlineContentRenderProps<
  typeof configs.citationConfig,
  StyleSchema
>): ReactNode {
  const { t } = useBlogTranslation('editor')
  return (
    <span contentEditable={false} className={layout1Class}>
      <CitationPicker
        referenceId={inlineContent.props.referenceId}
        select={referenceId => updateInlineContent({
          type: 'citation',
          props: { ...inlineContent.props, referenceId },
        })}
      />
      <Input
        aria-label={t('citationLocator')}
        value={inlineContent.props.locator}
        maxLength={100}
        onChange={event =>
          updateInlineContent({
            type: 'citation',
            props: {
              ...inlineContent.props,
              locator: event.currentTarget.value,
            },
          })}
      />
    </span>
  )
}

function CitationPicker({ referenceId, select }: { referenceId: string, select: (id: string) => void }): ReactNode {
  const { t } = useBlogTranslation('editor')
  const metadata = use(RichMetadataContext)
  const [query, setQuery] = useState('')
  const statusId = useId()
  const matches = matchingReferences(metadata.references, query)
  const selected = metadata.references.find(reference => reference.id === referenceId)
  const empty = matches.length === 0
  const missing = referenceId !== '' && selected === undefined
  return (
    <>
      <Label className="grid gap-2 citation-search flex-[1_1_180px] min-w-0">
        <span className={layout2Class}>
          {t('searchReferences')}
        </span>
        <Input
          type="search"
          value={query}
          maxLength={120}
          placeholder={t('referenceKeyAuthorOrTitle')}
          aria-describedby={empty ? statusId : undefined}
          onChange={event => setQuery(event.currentTarget.value)}
        />
      </Label>
      <ChoiceSelect
        label={t('citationReference')}
        aria-invalid={missing || undefined}
        aria-describedby={empty ? statusId : undefined}
        value={referenceId}
        onValueChange={select}
        options={[
          { value: '', label: t('chooseReference') },
          ...(missing
            ? [
                { value: referenceId, label: t('missingReference'), disabled: true },
              ]
            : []),
          ...(selected !== undefined && !matches.some(reference => reference.id === selected.id)
            ? [
                { value: selected.id, label: `${selected.title} (${t('currentSelection')})` },
              ]
            : []),
          ...matches.map(reference => ({ value: reference.id, label: reference.title })),
        ]}
      />
      {empty && (
        <span id={statusId} className="citation-search-empty basis-full text-muted-foreground text-help" role="status">
          {t(metadata.references.length === 0 ? 'noReferencesYet' : 'noMatchingReferences')}
        </span>
      )}
    </>
  )
}
export function FootnoteReferenceView({
  inlineContent,
  updateInlineContent,
}: ReactCustomInlineContentRenderProps<
  typeof configs.footnoteRefConfig,
  StyleSchema
>): ReactNode {
  const { t } = useBlogTranslation('editor')
  const metadata = use(RichMetadataContext)
  const noteId = inlineContent.props.noteId
  const missing = noteId !== '' && !metadata.footnotes.some(note => note.id === noteId)
  return (
    <span contentEditable={false}>
      <ChoiceSelect
        label={t('footnoteReference')}
        aria-invalid={missing || undefined}
        value={inlineContent.props.noteId}
        onValueChange={value =>
          updateInlineContent({
            type: 'footnoteRef',
            props: {
              noteId: value,
            },
          })}
        options={[
          { value: '', label: t('chooseFootnote') },
          ...(missing
            ? [
                { value: noteId, label: t('missingFootnote'), disabled: true },
              ]
            : []),
          ...metadata.footnotes.map(note => ({ value: note.id, label: note.label })),
        ]}
      />
    </span>
  )
}
export { InlineMathView } from '@/features/editor/ui/inline-math-view'
