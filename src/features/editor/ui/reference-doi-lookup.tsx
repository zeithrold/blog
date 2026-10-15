import type { ReactNode } from 'react'
import type { useReferenceForm } from '@/features/editor/services/reference-form'
import { LoaderCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/ztd-me/client'
import { ReferenceField } from '@/features/editor/ui/reference-form-fields'
import { useBlogTranslation } from '@/i18n/use-translation'

export function DoiLookup({ model }: { model: ReturnType<typeof useReferenceForm> }): ReactNode {
  const { t } = useBlogTranslation('editor')
  const loading = model.lookup.state === 'loading'
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="grid gap-3 min-[501px]:grid-cols-[minmax(0,1fr)_auto] min-[501px]:items-end">
        <ReferenceField
          name="doi"
          label="DOI"
          error={model.errors.doi}
          value={model.draft.doi}
          change={model.change}
          inputProps={{
            maxLength: 2048,
            placeholder: '10.xxxx/…',
            autoCapitalize: 'none',
            spellCheck: false,
            onKeyDown: (event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (!loading) {
                  model.retrieve().catch(() => {})
                }
              }
            },
          }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={loading || model.draft.doi.trim() === ''}
          onClick={() => { model.retrieve().catch(() => {}) }}
        >
          {loading
            ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            : <Sparkles size={16} aria-hidden="true" />}
          {loading ? t('referenceLookupLoading') : t('referenceLookup')}
        </Button>
      </div>
      <p className="m-0 text-help text-muted-foreground">{t('referenceDoiHelp')}</p>
      {model.lookup.message !== '' && (
        <p
          role={model.lookup.state === 'error' ? 'alert' : 'status'}
          className={model.lookup.state === 'error' ? 'm-0 text-help text-destructive' : 'm-0 text-help'}
        >
          {model.lookup.message}
        </p>
      )}
    </div>
  )
}
