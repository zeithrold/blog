import type { ReactNode } from 'react'
import type { Document } from '@/content/document'
import type { Envelope } from '@/features/editor/workspace/document-model'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
} from '@/components/ui/ztd-me/client'
import { ReferenceDialog } from '@/features/editor/references/reference-dialog'
import { useReferencePage } from '@/features/editor/references/reference-page'
import { useBlogTranslation } from '@/i18n/use-translation'

type Reference = Document['references'][number]
type Session = { reference: Reference, creating: boolean, key: number }

export function ReferenceSettings({ workspace, update, open, setOpen }: {
  workspace: Workspace
  update: (patch: Partial<Envelope>) => void
  open: boolean
  setOpen: (open: boolean) => void
}): ReactNode {
  const { t } = useBlogTranslation('editor')
  const references = workspace.model.envelope.references
  const page = useReferencePage()
  const [session, setSession] = useState<Session | null>(null)
  const returnFocusRef = useRef<HTMLButtonElement | null>(null)
  const edit = (reference: Reference, creating: boolean, trigger: HTMLButtonElement): void => {
    returnFocusRef.current = trigger
    setSession(current => ({ reference, creating, key: (current?.key ?? 0) + 1 }))
    setOpen(true)
    page?.enter()
  }
  const save = (reference: Reference): void => {
    update({
      references: session?.creating === true
        ? [
            ...references,
            reference,
          ]
        : references.map(item => item.id === reference.id ? reference : item),
    })
    setOpen(false)
  }
  return (
    <Accordion type="single" collapsible className="reference-settings">
      <AccordionItem value="references">
        <AccordionTrigger>
          <span>
            {t('references')}
            {' '}
            (
            {references.length}
            )
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <ReferenceContent workspace={workspace} edit={edit} update={update} />
        </AccordionContent>
      </AccordionItem>
      {session !== null && (
        <ReferenceDialog
          key={session.key}
          reference={session.reference}
          creating={session.creating}
          open={open}
          onOpenChange={setOpen}
          save={save}
          returnFocus={() => returnFocusRef.current}
        />
      )}
    </Accordion>
  )
}

function ReferenceContent({ workspace, edit, update }: {
  workspace: Workspace
  edit: (reference: Reference, creating: boolean, trigger: HTMLButtonElement) => void
  update: (patch: Partial<Envelope>) => void
}): ReactNode {
  const { t } = useBlogTranslation('editor')
  return (
    <div data-slot="reference-settings-content" className="grid min-w-0 gap-3">
      <ReferenceList workspace={workspace} edit={edit} update={update} />
      <Button
        className="w-full"
        variant="outline"
        type="button"
        disabled={workspace.busy || workspace.model.envelope.references.length >= 500}
        onClick={event => edit(newReference(), true, event.currentTarget)}
      >
        <Plus size={16} aria-hidden="true" />
        {t('addReference')}
      </Button>
    </div>
  )
}

function ReferenceList({ workspace, edit, update }: {
  workspace: Workspace
  edit: (reference: Reference, creating: boolean, trigger: HTMLButtonElement) => void
  update: (patch: Partial<Envelope>) => void
}): ReactNode {
  const { t } = useBlogTranslation('editor')
  const references = workspace.model.envelope.references
  const cited = new Set(workspace.model.nodeItems.flatMap(node => node.references))
  return references.length === 0
    ? (
        <p className="m-0 px-3 py-2 text-center text-help leading-relaxed text-muted-foreground">
          {t('referenceListEmpty')}
        </p>
      )
    : (
        <ul className="m-0 grid list-none p-0" aria-label={t('references')}>
          {references.map(reference => (
            <ReferenceRow
              key={reference.id}
              reference={reference}
              cited={cited.has(reference.id)}
              busy={workspace.busy}
              edit={trigger => edit(reference, false, trigger)}
              remove={() => update({ references: references.filter(item => item.id !== reference.id) })}
            />
          ))}
        </ul>
      )
}

function ReferenceRow({ reference, cited, busy, edit, remove }: {
  reference: Reference
  cited: boolean
  busy: boolean
  edit: (trigger: HTMLButtonElement) => void
  remove: () => void
}): ReactNode {
  const { t } = useBlogTranslation('editor')
  const subtitle = [
    reference.authors.join(', '),
    reference.year,
  ].filter(Boolean).join(' · ')
  return (
    <li className="reference-item grid gap-1 border-b border-border py-3 last:border-b-0">
      <div className="flex min-w-0 items-start gap-2">
        <FileText size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="m-0 line-clamp-2 wrap-anywhere text-control font-medium">{reference.title}</p>
          <p className="m-0 line-clamp-2 wrap-anywhere text-help text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('editReferenceNamed', { title: reference.title })}
          title={t('editReference')}
          disabled={busy}
          onClick={event => edit(event.currentTarget)}
        >
          <Pencil size={16} aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={busy || cited}
          aria-label={t('removeReferenceNamed', { title: reference.title })}
          title={cited ? t('removeCitationsBeforeReference') : t('removeReference')}
          onClick={remove}
        >
          <Trash2 size={16} aria-hidden="true" />
        </Button>
      </div>
      {cited && (
        <p className="m-0 text-help text-muted-foreground">{t('removeCitationsBeforeReference')}</p>
      )}
    </li>
  )
}

function newReference(): Reference {
  return { id: crypto.randomUUID(), title: '', authors: [], year: null, url: '', doi: '' }
}
