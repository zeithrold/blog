'use client'
import type { ReactNode } from 'react'
import type { GallerySession } from '@/features/media/gallery-session'
import type { MediaRole } from '@/features/media/media-types'
import { RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'
import { ChoiceSelect } from '@/components/ui/choice-select'
import { Button, Input, Label } from '@/components/ui/ztd-me/client'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { assetRoleSchema } from '@/content/service-contracts'
import { MediaGallery } from '@/features/media/media-gallery'
import { useMediaManager } from '@/features/media/media-model'
import { MediaUploadOverlay } from '@/features/media/media-upload'
import { EditorText } from '@/i18n/labels'
import { useEditorLabels } from '@/i18n/use-labels'
import { AdminEmpty, AdminFeedback } from '@/shared/admin/feedback'

const utility1Class = [
  'admin-page media-page max-w-290 my-0 mx-auto pt-9 px-[max(40px,_env(safe-area-inset-left))]',
  'pb-18',
].join(' ')

const utility2Class = [
  'pl-18 max-[1023.99px]:px-6 max-[639.99px]:pt-8 max-[639.99px]:px-4 max-[639.99px]:pb-14',
].join(' ')

const utility3Class = [
  'admin-heading media-heading flex flex-wrap justify-between gap-y-4 gap-x-6 mb-7',
  '[&_.eyebrow]:mb-3',
].join(' ')

const utility4Class = [
  '[&_h1]:text-[length:28px] [&_h1]:font-semibold [&_h1]:tracking-[-0.025em]',
  '[&_h1]:leading-[1.25]',
].join(' ')

const utility5Class = ['[&_.admin-description]:mt-3 [&_.admin-description]:mx-0 [&_.admin-description]:mb-0'].join(' ')

const utility6Class = [
  'max-[701px]:[&_.eyebrow]:mb-[6px] max-[701px]:[&_.admin-description]:mt-2 max-[701px]:gap-4',
].join(' ')

const utility7Class = [
  'media-toolbar flex items-center gap-3 mb-6 [&_.choice-select]:w-[170px] max-[701px]:flex-wrap',
].join(' ')

const utility8Class = [
  'visually-hidden absolute w-px h-px m-[-1px] p-0 overflow-hidden [clip-path:inset(50%)]',
].join(' ')

const utility9Class = ['admin-description max-w-[56rem] mt-[-14px] mx-0 mb-7 text-muted-foreground text-help'].join(' ')

const layout1Class = [utility1Class, utility2Class].join(' ')

const layout2Class = [
  utility3Class,
  utility4Class,
  utility5Class,
  utility6Class,
  'items-center',
].join(' ')

const layout3Class = [
  'm-0 text-[clamp(44px,6vw,68px)] font-medium tracking-[-0.045em] leading-[1.08]',
  '[html:lang(zh-CN)_&]:tracking-[-0.02em] [html:lang(zh-CN)_&]:leading-[1.2]',
].join(' ')

const layout4Class = [utility7Class, 'max-[701px]:[&_.choice-select]:flex-1'].join(' ')

const layout5Class = [utility8Class, 'whitespace-nowrap border-0'].join(' ')

type Model = ReturnType<typeof useMediaManager>
const MEDIA_NOTE = 'Upload once, reuse in your writing. Media becomes public only while referenced '
  + 'by a published document.'
const QUEUE_NOTE = 'Uploads stay available as you move between pages in this tab. Keep this tab open until they finish.'
export function MediaManager({ session, retry }: {
  session: GallerySession
  retry: () => Promise<void>
}): ReactNode {
  const model = useMediaManager(session)
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<MediaRole | 'all'>('all')
  const normalized = query.trim().toLocaleLowerCase()
  const items = model.items.filter(asset => (role === 'all' || asset.role === role)
    && asset.filename.toLocaleLowerCase().includes(normalized))
  return (
    <section className={layout1Class}>
      <header className={layout2Class}>
        <div>
          <h1 className={layout3Class}><EditorText value="Gallery" /></h1>
          <p className={[utility9Class, 'leading-[1.6]'].join(' ')}>
            <EditorText value={MEDIA_NOTE} />
          </p>
        </div>
        <MediaUploadOverlay
          model={{ ...model, loading: model.loading || model.unavailable }}
          open={model.open}
          onOpenChange={model.setOpen}
        />
      </header>
      <GalleryQueueNote model={model} />
      <MediaToolbar {...{ model, query, setQuery, role, setRole }} />
      <AdminFeedback loading={model.loading} error={model.error} retry={model.unavailable ? retry : model.load} />
      {model.loaded && items.length === 0 && model.error === '' && (
        <AdminEmpty
          title={model.items.length === 0 ? 'No media yet' : 'No media matches'}
          description={model.items.length === 0
            ? 'Upload a file to build your media library.'
            : 'Try another search or media type.'}
        />
      )}
      <MediaGallery items={items} />
      {model.cursor !== null && (
        <Button
          variant="outline"
          className="more-button mt-4"
          type="button"
          disabled={model.loading || model.uploading}
          onClick={() => { model.load(true).catch(() => {}) }}
        >
          <EditorText value="Load more media" />
        </Button>
      )}
    </section>
  )
}

function GalleryQueueNote({ model }: { model: Model }): ReactNode {
  return model.uploads.items.length === 0
    ? null
    : (
        <p className="media-session-note mb-6 text-help leading-relaxed text-muted-foreground" role="status">
          <EditorText value={QUEUE_NOTE} />
        </p>
      )
}

function MediaToolbar({ model, query, setQuery, role, setRole }: {
  model: Model
  query: string
  setQuery: (query: string) => void
  role: MediaRole | 'all'
  setRole: (role: MediaRole | 'all') => void
}): ReactNode {
  const text = useEditorLabels()
  const options = [
    { value: 'all', label: text('All media') },
    ...assetRoleSchema.options.map(value => ({ value, label: text(value) })),
  ]
  return (
    <div className={layout4Class}>
      <Label className={cn('grid gap-2', [
        'media-search relative flex-1 min-w-0 [&_>_svg]:absolute [&_>_svg]:top-[13px]',
        '[&_>_svg]:left-3 [&_>_svg]:text-muted-foreground [&_>_svg]:pointer-events-none',
        '[&_input]:pl-[38px] max-[701px]:basis-full',
      ].join(' '))}
      >
        <Search size={17} aria-hidden="true" />
        <span className={layout5Class}>
          {text('Search loaded media')}
        </span>
        <Input
          type="search"
          value={query}
          placeholder={text('Search loaded media')}
          onChange={event => setQuery(event.currentTarget.value)}
        />
      </Label>
      <ChoiceSelect
        value={role}
        options={options}
        label={text('Media type')}
        onValueChange={value => setRole(value === 'all' ? 'all' : assetRoleSchema.parse(value))}
      />
      <Button
        variant="ghost"
        type="button"
        disabled={model.loading || model.uploading || model.unavailable}
        onClick={() => { model.load().catch(() => {}) }}
      >
        <RefreshCw size={16} aria-hidden="true" />
        <EditorText value="Refresh" />
      </Button>
    </div>
  )
}
