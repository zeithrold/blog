import type { ReactNode } from 'react'
import type { Envelope } from '@/features/editor/workspace/document-model'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { useId } from 'react'
import { ChoiceSelect } from '@/components/ui/choice-select'
import { Checkbox, Input, Label, Textarea, useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { publicationPath } from '@/content/publication-path'
import { useBlogTranslation } from '@/i18n/use-translation'

const utility1Class = [
  'editor-language-notice editor-field-help m-0 text-muted-foreground text-help leading-[1.65]',
].join(' ')

const utility2Class = [
  'editor-field-help notice [&_button]:mt-2 [&_button]:mr-2 [&_button]:mb-0 [&_button]:ml-0',
].join(' ')

const utility3Class = [
  'py-3 px-4 border border-border rounded-[12px] bg-card m-0 text-muted-foreground text-help',
].join(' ')

const utility4Class = ['editor-field-help m-0 text-muted-foreground text-help leading-[1.65] wrap-anywhere'].join(' ')

const layout1Class = [utility1Class, 'wrap-anywhere py-3 px-4 border-b border-border bg-muted'].join(' ')

export function MetaFields({
  workspace,
  update,
  livePath,
}: {
  workspace: Workspace
  update: (patch: Partial<Envelope>) => void
  livePath: string | null
}): ReactNode {
  const text = useBlogTranslation('editor').t
  const { model, busy } = workspace
  const meta = model.envelope.meta
  return (
    <>
      <SlugField workspace={workspace} update={update} livePath={livePath} />
      <Label className="grid gap-2">
        {text('description')}
        <Textarea
          disabled={busy}
          value={meta.description}
          maxLength={500}
          onChange={event =>
            update({
              meta: {
                ...meta,
                description: event.currentTarget.value,
              },
            })}
        />
      </Label>
      <LanguageFields workspace={workspace} update={update} />
    </>
  )
}

function SlugField({
  workspace,
  update,
  livePath,
}: {
  workspace: Workspace
  update: (patch: Partial<Envelope>) => void
  livePath: string | null
}): ReactNode {
  const text = useBlogTranslation('editor').t
  const { model, busy } = workspace
  const meta = model.envelope.meta
  const slugHelpId = useId()
  const changedPath = livePath !== null && publicationPath(workspace.props.initial.kind, meta.slug) !== livePath
  const help = changedPath
    ? text('afterPublishingTheOldURLValue0WillStopWorkingNoRedirectIs', { value0: livePath })
    : text('useLowercaseLettersNumbersAndHyphens')
  return (
    <>
      <Label className="grid gap-2">
        {text('slug')}
        <Input
          aria-describedby={slugHelpId}
          spellCheck={false}
          autoCapitalize="none"
          disabled={busy}
          value={meta.slug}
          maxLength={120}
          onChange={event =>
            update({
              meta: {
                ...meta,
                slug: event.currentTarget.value,
              },
            })}
        />
      </Label>
      <p
        id={slugHelpId}
        className={changedPath
          ? [
              utility2Class,
              utility3Class,
              'leading-[1.65] wrap-anywhere',
            ].join(' ')
          : utility4Class}
      >
        {help}
      </p>
    </>
  )
}

function LanguageFields({
  workspace,
  update,
}: {
  workspace: Workspace
  update: (patch: Partial<Envelope>) => void
}): ReactNode {
  const { preferences } = useFrontendPreferences()
  const text = useBlogTranslation('editor').t
  const { model, busy } = workspace
  const meta = model.envelope.meta
  return (
    <>
      {' '}
      <Label className="grid gap-2">
        {text('documentLanguage')}
        <ChoiceSelect
          label={text('documentLanguage')}
          value={meta.documentLocale}
          disabled={busy}
          onValueChange={value =>
            update({
              meta: {
                ...meta,
                documentLocale: value === 'zh-CN' ? 'zh-CN' : 'en',
              },
            })}
          options={[
            { value: 'en', label: text('english') },
            { value: 'zh-CN', label: text('simplifiedChinese') },
          ]}
        />
      </Label>
      {preferences.locale !== model.editorLocale && (
        <p className={layout1Class} role="status">
          {text('theNativeEditorMenuLanguageUpdatesNextTimeYouOpenThisDocument')}
        </p>
      )}
      <Label className="checkbox-field flex items-center gap-2.5 font-normal">
        <Checkbox
          checked={meta.seo.noindex}
          disabled={busy}
          onCheckedChange={checked =>
            update({
              meta: {
                ...meta,
                seo: {
                  noindex: checked === true,
                },
              },
            })}
        />
        {text('excludeFromSearch')}
      </Label>
    </>
  )
}
