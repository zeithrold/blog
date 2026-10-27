import type { ReactNode } from 'react'
import type { TagColor } from '@/content/tag-color'
import { ColorGrid } from '@/components/ui/ztd-me/client'
import { tagColorSchema } from '@/content/tag-color'
import { useEditorLabels } from '@/i18n/use-labels'

const colorLabels = {
  neutral: 'Default color',
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  violet: 'Violet',
  pink: 'Pink',
} as const

const colorInk: Record<TagColor, string> = {
  neutral: 'var(--ztd-muted-foreground)',
  red: 'var(--blog-inline-red)',
  orange: 'var(--blog-inline-orange)',
  yellow: 'var(--blog-inline-yellow)',
  green: 'var(--blog-inline-green)',
  blue: 'var(--blog-inline-blue)',
  violet: 'var(--blog-inline-purple)',
  pink: 'var(--blog-inline-pink)',
}

export function TagColorField({ value, disabled, onChange }: {
  value: TagColor
  disabled: boolean
  onChange: (color: TagColor) => void
}): ReactNode {
  const text = useEditorLabels()
  return (
    <ColorGrid
      label={text('Tag color')}
      options={tagColorSchema.options.map(color => ({
        value: color,
        label: text(colorLabels[color]),
        foreground: colorInk[color],
        background: color === 'neutral'
          ? 'var(--ztd-surface)'
          : `color-mix(in srgb, ${colorInk[color]} 10%, var(--ztd-surface))`,
      }))}
      value={value}
      disabled={disabled}
      onValueChange={color => onChange(tagColorSchema.parse(color))}
    />
  )
}
