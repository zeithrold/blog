import type { ReactNode } from 'react'
import type { useAuthorPage } from '@/features/editor/services/reference-author-page'
import { useId, useState } from 'react'
import { Button, Input, Label, Textarea } from '@/components/ui/ztd-me/client'
import { useBlogTranslation } from '@/i18n/use-translation'

type Model = ReturnType<typeof useAuthorPage>
export function ReferenceAuthorEditor({ model }: { model: Model }): ReactNode {
  const { t } = useBlogTranslation('editor')
  if (model.session?.confirming === true) {
    return <DiscardAuthor model={model} />
  }
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        model.submit()
      }}
    >
      <div data-vaul-no-drag="" className="grid min-h-0 gap-4 overflow-y-auto overscroll-contain px-6 pt-1 pb-6">
        <AuthorInput model={model} />
      </div>
      <div className="mt-auto flex shrink-0 justify-end gap-3 border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={model.close}>{t('cancel')}</Button>
        <Button type="submit">{t('save')}</Button>
      </div>
    </form>
  )
}
function AuthorInput({ model }: { model: Model }): ReactNode {
  const { t } = useBlogTranslation('editor')
  const id = useId()
  const value = model.session?.value ?? ''
  const [batch, setBatch] = useState(() => /[\r\n]/u.test(value))
  const Field = batch ? Textarea : Input
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t('referenceAuthorName')}</Label>
      <Field
        id={id}
        data-author-input=""
        value={value}
        required
        aria-invalid={model.session?.invalid === true}
        aria-describedby={`${id}-help${model.session?.invalid === true ? ` ${id}-error` : ''}`}
        placeholder={t('referenceAuthorPlaceholder')}
        onChange={event => model.change(event.currentTarget.value)}
        onPaste={(event) => {
          const text = event.clipboardData.getData('text')
          if (/[\r\n]/u.test(text)) {
            event.preventDefault()
            setBatch(true)
            const input = event.currentTarget
            model.change(value.slice(0, input.selectionStart ?? 0) + text
              + value.slice(input.selectionEnd ?? value.length))
            requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }))
          }
        }}
      />
      <p id={`${id}-help`} className="m-0 text-help text-muted-foreground">{t('referenceAuthorInputHelp')}</p>
      {model.session?.invalid === true && (
        <p id={`${id}-error`} role="alert" className="m-0 text-help text-destructive">
          {t('referenceAuthorsInvalid')}
        </p>
      )}
    </div>
  )
}
function DiscardAuthor({ model }: { model: Model }): ReactNode {
  const { t } = useBlogTranslation('editor')
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="alert" className="grid gap-3 px-6 py-4">
        <h3 className="m-0 text-body font-semibold">{t('referenceAuthorDiscardTitle')}</h3>
        <p className="m-0 text-control text-muted-foreground">{t('referenceAuthorDiscardDescription')}</p>
      </div>
      <div className="mt-auto flex shrink-0 flex-wrap justify-end gap-3 border-t border-border px-6 py-4">
        <Button type="button" variant="outline" data-author-keep="" onClick={model.keep}>
          {t('referenceKeepEditing')}
        </Button>
        <Button type="button" variant="destructive" onClick={model.finish}>{t('referenceDiscard')}</Button>
      </div>
    </div>
  )
}
