import type { StyleSchema } from '@blocknote/core'
import type { ReactCustomInlineContentRenderProps } from '@blocknote/react'
import type { ReactNode } from 'react'
import type * as configs from '@/features/editor/blocks/rich-config'
import { use, useId, useState } from 'react'
import { ChoiceSelect } from '@/components/ui/choice-select'
import { Button, Input, Label } from '@/components/ui/ztd-me/client'
import { BlockSettings } from '@/features/editor/blocks/block-settings'
import { RichMetadataContext } from '@/features/editor/blocks/rich-context'
import { useRichEditor } from '@/features/editor/engine/use-rich-editor'
import { matchingReferences } from '@/features/editor/references/citation-search'
import { useBlogTranslation } from '@/i18n/use-translation'

const markerClass = [
  'inline-reference-marker min-h-0 min-w-0 rounded px-1 py-0 align-baseline [font-family:inherit] text-inherit',
  'leading-[inherit] pointer-coarse:min-h-0 text-primary underline-offset-2 hover:underline',
].join(' ')

function ReferenceSettings({ title, marker, missing, children }: {
  title: string
  marker: ReactNode
  missing: boolean
  children: ReactNode
}): ReactNode {
  const editor = useRichEditor()
  return (
    <span contentEditable={false} className="inline-reference inline whitespace-nowrap">
      <BlockSettings
        title={title}
        disabled={!editor.isEditable}
        initialOpen={missing && editor.isFocused()}
        trigger={(
          <Button
            type="button"
            variant="ghost"
            className={markerClass}
            aria-label={title}
            aria-invalid={missing || undefined}
            disabled={!editor.isEditable}
          >
            <span className="inline-block max-w-36 truncate" title={typeof marker === 'string' ? marker : undefined}>
              {marker}
            </span>
          </Button>
        )}
      >
        <fieldset disabled={!editor.isEditable} className="m-0 grid min-w-0 gap-5 border-0 p-0">
          {children}
        </fieldset>
      </BlockSettings>
    </span>
  )
}

export function CitationView({
  inlineContent,
  updateInlineContent,
}: ReactCustomInlineContentRenderProps<
  typeof configs.citationConfig,
  StyleSchema
>): ReactNode {
  const { t } = useBlogTranslation('editor')
  const metadata = use(RichMetadataContext)
  const editor = useRichEditor()
  const number = metadata.citationNumbers.get(inlineContent.props.referenceId)
  const found = metadata.references.some(reference => reference.id === inlineContent.props.referenceId)
  const locator = inlineContent.props.locator
  const marker = `[${found ? number ?? '?' : '?'}${locator !== '' ? `, ${locator}` : ''}]`
  return (
    <ReferenceSettings
      title={t('citationReference')}
      missing={!found}
      marker={marker}
    >
      <CitationPicker
        referenceId={inlineContent.props.referenceId}
        select={referenceId => editor.isEditable && updateInlineContent({
          type: 'citation',
          props: { ...inlineContent.props, referenceId },
        })}
      />
      <Input
        aria-label={t('citationLocator')}
        value={inlineContent.props.locator}
        maxLength={100}
        onChange={event =>
          editor.isEditable && updateInlineContent({
            type: 'citation',
            props: {
              ...inlineContent.props,
              locator: event.currentTarget.value,
            },
          })}
      />
    </ReferenceSettings>
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
      <Label className="grid min-w-0 gap-2 citation-search">
        <span className="sr-only">
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
  const editor = useRichEditor()
  const noteId = inlineContent.props.noteId
  const missing = noteId !== '' && !metadata.footnotes.some(note => note.id === noteId)
  return (
    <ReferenceSettings
      title={t('footnoteReference')}
      missing={noteId === '' || missing}
      marker={<sup>{missing ? '?' : metadata.noteNumbers.get(noteId) ?? '?'}</sup>}
    >
      <ChoiceSelect
        label={t('footnoteReference')}
        aria-invalid={missing || undefined}
        value={inlineContent.props.noteId}
        onValueChange={value =>
          editor.isEditable && updateInlineContent({
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
    </ReferenceSettings>
  )
}
export { InlineMathView } from '@/features/editor/blocks/source/inline-math-view'
