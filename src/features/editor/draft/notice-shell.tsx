import type { ReactNode, Ref } from 'react'
import { useId } from 'react'

const utility1Class = [
  'editor-notice grid grid-cols-[20px_minmax(0,_1fr)] gap-[10px] mt-0 mx-0 mb-8 p-4 border',
].join(' ')

const utility2Class = [
  'bg-[color-mix(in_srgb,_var(--ztd-muted)_45%,_var(--ztd-background))] text-help leading-[1.6]',
].join(' ')

const utility3Class = [
  '[&[data-tone=error]_.editor-notice-icon]:text-destructive max-[701px]:gap-2 max-[701px]:p-3',
].join(' ')

const utility4Class = [
  '[&_>_section_>_button]:text-[length:13px] max-[701px]:[&_>_section_>_button]:min-h-11',
].join(' ')

const utility5Class = ['editor-notice-icon flex items-center justify-center h-[22px] text-muted-foreground'].join(' ')

const layout1Class = [
  utility1Class,
  'border-[color-mix(in_srgb,_var(--ztd-border)_75%,_transparent)] rounded-[12px]',
  utility2Class,
  '[&[data-tone=conflict]_.editor-notice-icon]:text-[var(--ztd-warning)]',
  utility3Class,
].join(' ')

const layout2Class = [
  'editor-notice-body min-w-0 [&_>_section]:mt-3 [&_>_section_>_button]:min-h-9',
  '[&_>_section_>_button]:py-[7px] [&_>_section_>_button]:px-[10px]',
  utility4Class,
].join(' ')

type EditorNoticeProps = {
  ref?: Ref<HTMLElement>
  tabIndex?: number
  title: string
  icon: ReactNode
  tone: 'recovery' | 'conflict' | 'error'
  children: ReactNode
}

export function EditorNotice({ title, icon, tone, children, ref, tabIndex }: EditorNoticeProps): ReactNode {
  const titleId = useId()
  return (
    <section ref={ref} tabIndex={tabIndex} className={layout1Class} data-tone={tone} aria-labelledby={titleId}>
      <span className={utility5Class} aria-hidden="true">{icon}</span>
      <div className={layout2Class}>
        <h2 id={titleId} className="editor-notice-title mt-0 mx-0 mb-1 text-help font-medium leading-[1.6]">{title}</h2>
        {children}
      </div>
    </section>
  )
}
