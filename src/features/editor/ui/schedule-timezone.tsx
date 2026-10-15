import type { ReactNode } from 'react'
import type { ScheduleModel } from '@/features/editor/services/schedule-controller'
import { useId, useMemo } from 'react'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Label } from '@/components/ui/ztd-me/client'
import { useBlogTranslation } from '@/i18n/use-translation'

function timezoneOptions(current: string, locale: string): { value: string, label: string }[] {
  const zones = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [
        'Asia/Taipei',
        'Asia/Shanghai',
        'Asia/Tokyo',
        'Europe/London',
        'America/New_York',
      ]
  return Array.from(new Set([
    'UTC',
    current,
    ...zones,
  ])).sort().map((value) => {
    const name = new Intl.DateTimeFormat(locale, { timeZone: value, timeZoneName: 'longGeneric' })
      .formatToParts()
      .find(part => part.type === 'timeZoneName')
      ?.value ?? value
    return { value, label: name === value ? value : `${name} · ${value}` }
  })
}

export function ScheduleTimezone({ model, disabled }: { model: ScheduleModel, disabled: boolean }): ReactNode {
  const { t, locale } = useBlogTranslation('editor')
  const id = useId()
  const options = useMemo(() => timezoneOptions(model.timezone, locale), [model.timezone, locale])
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t('publicationTimezone')}</Label>
      <SearchableSelect
        id={id}
        label={t('publicationTimezone')}
        searchLabel={t('searchTimezones')}
        placeholder={t('publicationTimezone')}
        emptyLabel={t('noMatchingTimezone')}
        loadingLabel=""
        clearLabel={t('useDeviceTimezone')}
        retryLabel=""
        options={options}
        values={[model.timezone]}
        disabled={disabled}
        onValuesChange={(values) => {
          model.update('timezone', values[0] ?? new Intl.DateTimeFormat().resolvedOptions().timeZone)
        }}
      />
      <p className="m-0 text-help leading-relaxed text-muted-foreground">{t('publicationTimezoneHelp')}</p>
    </div>
  )
}
