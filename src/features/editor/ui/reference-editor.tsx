import type { ReactNode, RefObject } from 'react'
import type { useReferenceEditor } from '@/features/editor/services/reference-exit'
import { ArrowLeft } from 'lucide-react'
import { Button, DialogDescription, DialogTitle } from '@/components/ui/ztd-me/client'
import { ReferenceAuthorEditor } from '@/features/editor/ui/reference-author-editor'
import { DoiLookup } from '@/features/editor/ui/reference-doi-lookup'
import { ReferenceFields } from '@/features/editor/ui/reference-form-fields'
import { useBlogTranslation } from '@/i18n/use-translation'

type Controller = ReturnType<typeof useReferenceEditor>
export function ReferenceEditor({ controller, creating, editorRef }: {
  controller: Controller
  creating: boolean
  editorRef: RefObject<HTMLDivElement | null>
}): ReactNode {
  return (
    <div ref={editorRef} data-slot="reference-editor" className="flex min-h-0 flex-1 flex-col">
      <ReferenceHeader controller={controller} creating={creating} />
      <div
        hidden={controller.confirming || controller.author.session !== null}
        data-hidden={controller.confirming || controller.author.session !== null}
        className="flex min-h-0 flex-1 flex-col data-[hidden=true]:hidden"
      >
        <ReferenceForm controller={controller} />
      </div>
      {controller.confirming && <DiscardReference controller={controller} />}
      {controller.author.session !== null && <ReferenceAuthorEditor model={controller.author} />}
    </div>
  )
}
function ReferenceHeader({ controller, creating }: { controller: Controller, creating: boolean }): ReactNode {
  const { t } = useBlogTranslation('editor')
  let title = creating ? t('addReference') : t('editReference')
  if (controller.author.session !== null) {
    title = controller.author.session.id === null ? t('referenceAddAuthor') : t('referenceEditAuthorTitle')
  }
  const description = controller.author.session === null
    ? t('referenceEditorDescription')
    : t('referenceAuthorEditorDescription')
  return (
    <div className="grid shrink-0 gap-2 px-6 pt-5 pb-4">
      <div className="flex items-center gap-2">
        {(controller.page !== null || controller.author.session !== null) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-ml-2"
            aria-label={t(controller.author.session === null ? 'referenceBack' : 'referenceAuthorBack')}
            onClick={controller.close}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Button>
        )}
        {controller.page === null
          ? <DialogTitle>{title}</DialogTitle>
          : <h2 id={controller.page.titleId} className="m-0 text-heading font-semibold">{title}</h2>}
      </div>
      {controller.page === null
        ? <DialogDescription>{description}</DialogDescription>
        : <p id={controller.page.descriptionId} className="m-0 text-help text-muted-foreground">{description}</p>}
    </div>
  )
}
function ReferenceForm({ controller }: { controller: Controller }): ReactNode {
  const { t } = useBlogTranslation('editor')
  const { model } = controller
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (model.lookup.state !== 'loading') {
          model.submit(event.currentTarget)
        }
      }}
    >
      <div
        data-slot="reference-form-scroll"
        className="grid min-h-0 gap-6 overflow-y-auto overscroll-contain px-6 pt-1 pb-6"
        data-vaul-no-drag=""
      >
        <DoiLookup model={model} />
        <ReferenceFields
          authors={model.authors}
          draft={model.draft}
          errors={model.errors}
          change={model.change}
          editAuthor={controller.author.edit}
        />
        <p className="m-0 text-help text-muted-foreground">{t('referenceRequiredHelp')}</p>
      </div>
      <div
        data-slot="dialog-footer"
        className="flex shrink-0 justify-end gap-3 border-t border-border bg-background px-6 py-4"
      >
        <Button type="button" variant="outline" onClick={controller.close}>{t('cancel')}</Button>
        <Button type="submit" disabled={model.lookup.state === 'loading'}>{t('save')}</Button>
      </div>
    </form>
  )
}
function DiscardReference({ controller }: { controller: Controller }): ReactNode {
  const { t } = useBlogTranslation('editor')
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="alert" className="grid gap-3 px-6 py-4">
        <h3 className="m-0 text-body font-semibold">{t('referenceDiscardTitle')}</h3>
        <p className="m-0 text-control text-muted-foreground">{t('referenceDiscardDescription')}</p>
      </div>
      <div className="mt-auto flex shrink-0 flex-wrap justify-end gap-3 border-t border-border px-6 py-4">
        <Button
          type="button"
          variant="outline"
          data-reference-keep=""
          onClick={controller.keep}
        >
          {t('referenceKeepEditing')}
        </Button>
        <Button type="button" variant="destructive" onClick={controller.finish}>{t('referenceDiscard')}</Button>
      </div>
    </div>
  )
}
