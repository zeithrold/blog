import type { ComponentProps, ReactNode } from 'react'
import type { AuthorDraft, referenceAuthorControls } from '@/features/editor/services/reference-authors'
import type { ReferenceDraft, ReferenceErrors, ReferenceFieldName } from '@/features/editor/services/reference-form'
import { useId } from 'react'
import { Input, Label } from '@/components/ui/ztd-me/client'
import { ReferenceAuthors } from '@/features/editor/ui/reference-authors'
import { useBlogTranslation } from '@/i18n/use-translation'

type FieldsProps = {
  editAuthor: (row?: AuthorDraft) => void
  authors: ReturnType<typeof referenceAuthorControls>
  draft: ReferenceDraft
  errors: ReferenceErrors
  change: (field: Exclude<ReferenceFieldName, 'authors'>, value: string) => void
}

export function ReferenceFields({ authors, draft, errors, change, editAuthor }: FieldsProps): ReactNode {
  const { t } = useBlogTranslation('editor')
  const props = (name: Exclude<ReferenceFieldName, 'authors'>):
  Omit<Parameters<typeof ReferenceField>[0], 'label'> => ({
    name,
    value: draft[name],
    error: errors[name],
    change,
  })
  return (
    <div className="grid gap-4">
      <ReferenceField
        {...props('title')}
        label={t('referenceTitle')}
        inputProps={{ maxLength: 500, required: true, placeholder: t('referenceTitlePlaceholder') }}
      />
      <ReferenceAuthors model={authors} error={errors.authors} edit={editAuthor} />
      <div className="grid gap-4 min-[601px]:grid-cols-[120px_minmax(0,1fr)]">
        <ReferenceField
          {...props('year')}
          label={t('year')}
          inputProps={{ type: 'number', min: 1, max: 9999, step: 1, placeholder: '2026' }}
        />
        <ReferenceField
          {...props('url')}
          label={t('uRL')}
          inputProps={{ maxLength: 2048, inputMode: 'url', placeholder: 'https://' }}
        />
      </div>
    </div>
  )
}

export function ReferenceField({ name, label, error, value, change, inputProps }: {
  name: Exclude<ReferenceFieldName, 'authors'>
  label: string
  error: string | undefined
  value: string
  change: FieldsProps['change']
  inputProps?: ComponentProps<typeof Input>
}): ReactNode {
  const id = useId()
  const common = {
    id,
    name,
    value,
    'aria-invalid': error !== undefined,
    'aria-describedby': error !== undefined ? `${id}-error` : undefined,
  }
  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex items-center gap-1 text-help text-muted-foreground">
        <Label htmlFor={id}>{label}</Label>
        {name === 'title' && <span aria-hidden="true">*</span>}
      </div>
      <Input
        {...inputProps}
        {...common}
        onChange={event => change(name, event.currentTarget.validity.badInput ? '-' : event.currentTarget.value)}
      />
      {error !== undefined && <p id={`${id}-error`} className="m-0 text-help text-destructive" role="alert">{error}</p>}
    </div>
  )
}
