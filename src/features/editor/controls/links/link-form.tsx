import type { ChangeEvent, ReactNode, SyntheticEvent } from 'react'
import type { LinkTarget } from '@/features/editor/engine/link-target'
import { useDictionary } from '@blocknote/react'
import { useId, useState } from 'react'
import { Button, DialogFooter, Input, Label } from '@/components/ui/ztd-me/client'
import { applyLinkTarget } from '@/features/editor/engine/link-target'
import { linkURLLimit, normalizeLinkURL } from '@/features/editor/engine/link-url'
import { useRichEditor } from '@/features/editor/engine/use-rich-editor'
import { useBlogTranslation } from '@/i18n/use-translation'

function useLinkForm(target: LinkTarget, stale: boolean, close: () => void) {
  const editor = useRichEditor()
  const text = useBlogTranslation('editor').t
  const [url, setURL] = useState(target.url)
  const [label, setLabel] = useState(target.text)
  const [invalid, setInvalid] = useState<'url' | 'text' | null>(null)
  const messages = { url: text('invalidLinkUrl'), text: text('invalidLinkText') }
  const validation = invalid === null ? '' : messages[invalid]
  const error = stale ? text('linkTargetChanged') : validation
  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const normalized = normalizeLinkURL(url)
    if (stale || normalized === null) {
      setInvalid('url')
      rejectField(event.currentTarget, 'url', text(stale ? 'linkTargetChanged' : 'invalidLinkUrl'))
      return
    }
    if (target.mode === 'edit' && label.trim() === '') {
      setInvalid('text')
      rejectField(event.currentTarget, 'title', text('invalidLinkText'))
      return
    }
    if (applyLinkTarget(editor, target, normalized, label)) {
      close()
    }
  }
  const clearInvalid = (event: ChangeEvent<HTMLInputElement>): void => {
    event.currentTarget.setCustomValidity('')
    setInvalid(null)
  }
  return { url, setURL, label, setLabel, invalid, error, submit, clearInvalid }
}

function rejectField(form: HTMLFormElement, name: string, message: string): void {
  const input = form.elements.namedItem(name)
  if (input instanceof HTMLInputElement) {
    input.setCustomValidity(message)
    input.focus()
  }
}

export function LinkEditorForm({ target, stale, close }: {
  target: LinkTarget
  stale: boolean
  close: () => void
}): ReactNode {
  const dictionary = useDictionary().link_toolbar.form
  const text = useBlogTranslation('editor').t
  const form = useLinkForm(target, stale, close)
  const errorId = useId()
  return (
    <form noValidate className="grid gap-5" onSubmit={form.submit}>
      <LinkURLField
        value={form.url}
        error={form.invalid === 'url' || stale ? form.error : ''}
        errorId={errorId}
        onChange={(event) => {
          form.setURL(event.currentTarget.value)
          form.clearInvalid(event)
        }}
      />
      {target.mode === 'edit' && (
        <Label className="grid gap-2">
          {dictionary.title_placeholder}
          <Input
            name="title"
            value={form.label}
            required
            aria-invalid={form.invalid === 'text'}
            aria-describedby={form.invalid === 'text' ? errorId : undefined}
            onChange={(event) => {
              form.setLabel(event.currentTarget.value)
              form.clearInvalid(event)
            }}
          />
        </Label>
      )}
      {form.error !== '' && <p id={errorId} className="m-0 text-help text-destructive" role="alert">{form.error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={close}>{text('cancel')}</Button>
        <Button type="submit" disabled={stale}>{text('save')}</Button>
      </DialogFooter>
    </form>
  )
}

function LinkURLField({ value, error, errorId, onChange }: {
  value: string
  error: string
  errorId: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}): ReactNode {
  const dictionary = useDictionary().link_toolbar.form
  return (
    <Label className="grid gap-2">
      {dictionary.url_placeholder}
      <Input
        name="url"
        value={value}
        required
        maxLength={linkURLLimit}
        autoCapitalize="none"
        autoComplete="url"
        spellCheck={false}
        inputMode="url"
        aria-invalid={error !== ''}
        aria-describedby={error === '' ? undefined : errorId}
        onChange={onChange}
      />
    </Label>
  )
}
