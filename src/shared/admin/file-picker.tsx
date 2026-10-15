import type { ComponentProps, ReactNode } from 'react'
import { Upload } from 'lucide-react'
import { Label } from '@/components/ui/ztd-me/client'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { useEditorLabels } from '@/i18n/use-labels'

const utility1Class = [
  'file-picker-control relative flex min-w-0 items-center justify-center gap-2 min-h-11 px-4 py-2',
].join(' ')

const utility2Class = [
  'rounded-md border border-border bg-background text-control text-foreground whitespace-nowrap',
].join(' ')

const layout1Class = [
  utility1Class,
  utility2Class,
  'hover:bg-muted focus-within:outline-2 focus-within:outline-focus focus-within:outline-offset-2',
  'has-disabled:opacity-50',
].join(' ')

type FilePickerProps = Omit<ComponentProps<'input'>, 'type'> & { label: string, hideLabel?: boolean }
export function FilePicker({ label, hideLabel = false, className = '', ...props }: FilePickerProps): ReactNode {
  const text = useEditorLabels()
  return (
    <Label className={cn('file-picker grid min-w-0 gap-2', className)}>
      <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
      <span className={layout1Class}>
        <Upload size={18} className="shrink-0" aria-hidden="true" />
        <span>{text('Choose a file')}</span>
        <input
          {...props}
          type="file"
          aria-label={label}
          className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </span>
    </Label>
  )
}
