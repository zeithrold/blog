export const layout1Class = [
  'history-comparison min-w-0 grid [&_h2]:m-0 [&_h2]:text-[length:18px] [&_h2]:font-medium gap-6',
  '[&_.history-comparison-heading_h2]:text-[length:16px] [&_.diff-row]:mb-2 [&_.diff-row]:p-0',
  '[&_.diff-row]:overflow-hidden max-[701px]:[&_.diff-values]:grid-cols-[minmax(0,_1fr)]',
].join(' ')

export const layout2Class = [
  'history-comparison-heading flex items-center justify-between gap-3 [&_h2]:flex',
  '[&_h2]:items-center [&_h2]:gap-2 [&_h2]:m-0 [&_h2]:text-[length:14px] [&_h2]:font-medium',
].join(' ')

export const layout3Class = [
  'history-identical [&_p]:m-0 [&_p]:text-[length:14px] grid [justify-items:center] gap-3 py-12',
  'px-5 [border:1px_dashed_var(--ztd-border)] rounded-[12px] text-muted-foreground text-center',
].join(' ')

export const layout4Class = [
  'diff-fields px-4 border border-border rounded-[12px] bg-card',
  '[&_>_.ztd-accordion-item:last-child]:border-b-0 [&_.ztd-accordion-trigger]:text-[length:14px]',
  'max-[701px]:px-3',
].join(' ')

export const layout5Class = [
  'diff-row [&_code]:text-muted-foreground [&_code]:font-[var(--blog-font-mono)] [&_code]:text-help',
  '[&_code]:wrap-anywhere mb-3 p-4 border border-border rounded-[12px] bg-card',
  '[&_.diff-block-trigger]:items-center [&_.diff-block-trigger]:gap-[10px]',
  '[&_.diff-block-trigger]:min-h-13 [&_.diff-block-trigger]:py-3 [&_.diff-block-trigger]:px-4',
  '[&_.diff-block-trigger]:text-foreground [&_.diff-block-trigger]:text-[length:14px]',
  '[&_.diff-block-trigger]:cursor-pointer',
  '[&[data-change=added]_.diff-kind]:bg-[color-mix(in_srgb,_var(--ztd-success)_8%,_var(--ztd-surface))]',
  '[&[data-change=added]_.diff-kind]:text-[var(--ztd-success)]',
  '[&[data-change=removed]_.diff-kind]:bg-[color-mix(in_srgb,_var(--ztd-destructive)_8%,_var(--ztd-surface))]',
  '[&[data-change=removed]_.diff-kind]:text-destructive',
].join(' ')

export const layout6Class = [
  'diff-block-trigger [&_>_svg]:ml-auto flex justify-start gap-3 w-full border-0 bg-transparent',
  'text-left [&[data-state=open]_>_svg]:transform-[rotate(180deg)]',
].join(' ')

export const layout7Class = [
  'diff-technical [&_>_.ztd-accordion-item]:border-b-0 mt-3 [&_.ztd-accordion-trigger]:min-h-9',
  '[&_.ztd-accordion-trigger]:py-[10px] [&_.ztd-accordion-trigger]:text-muted-foreground',
  '[&_.ztd-accordion-trigger]:text-[length:12px]',
].join(' ')

export const layout8Class = [
  'diff-values grid grid-cols-[minmax(0,_1fr)_minmax(0,_1fr)]',
  'max-[701px]:grid-cols-[minmax(0,_1fr)] gap-3 min-w-0 [&_.diff-value]:p-[14px]',
  '[&_.diff-value]:border [&_.diff-value]:border-border [&_.diff-value]:rounded-[8px]',
  '[&_.diff-value]:bg-background [&_.diff-value_h4]:mt-0 [&_.diff-value_h4]:mx-0',
  '[&_.diff-value_h4]:mb-[10px] [&_.diff-value_h4]:text-[length:12px]',
  '[&_.diff-value_h4]:font-normal',
].join(' ')

export const layout9Class = [
  'diff-value min-w-0 text-help whitespace-pre-wrap wrap-anywhere max-h-none overflow-visible',
  '[&_pre]:whitespace-pre-wrap [&_pre]:wrap-anywhere [&_pre]:m-0 [&_pre]:p-3 [&_pre]:rounded-[8px]',
  '[&_pre]:bg-muted [&_pre]:font-sans [&_pre]:text-control [&_pre]:leading-[1.8]',
  '[&_h4]:my-[12px_8px] [&_h4]:text-muted-foreground [&_h4]:text-help [&_h4]:font-medium',
  '[&_del]:bg-[color-mix(in_srgb,_var(--ztd-destructive)_16%,_transparent)] [&_del]:text-foreground',
  '[&_del]:[text-decoration-color:var(--ztd-destructive)]',
  '[&_ins]:bg-[color-mix(in_srgb,_var(--ztd-success)_18%,_transparent)] [&_ins]:text-foreground',
  '[&_ins]:underline [&_ins]:[text-decoration-color:var(--ztd-success)]',
].join(' ')

export const layout10Class = [
  'diff-value-scroll max-h-[22rem] [&_.ztd-scroll-viewport]:max-h-[22rem] [&_pre]:m-0',
  '[&_pre]:font-[inherit] [&_pre]:text-[length:14px] [&_pre]:leading-[1.75]',
  '[&_pre]:whitespace-pre-wrap [&_pre]:wrap-anywhere',
].join(' ')

export const layout11Class = [
  'diff-value min-w-0 text-help whitespace-pre-wrap wrap-anywhere max-h-none overflow-visible',
  '[&_pre]:whitespace-pre-wrap [&_pre]:wrap-anywhere [&_pre]:m-0 [&_pre]:p-3 [&_pre]:rounded-[8px]',
  '[&_pre]:bg-muted [&_pre]:font-sans [&_pre]:text-control [&_pre]:leading-[1.8]',
  '[&_h4]:my-[12px_8px] [&_h4]:text-muted-foreground [&_h4]:text-help [&_h4]:font-medium',
  '[&_del]:bg-[color-mix(in_srgb,_var(--ztd-destructive)_16%,_transparent)] [&_del]:text-foreground',
  '[&_del]:[text-decoration-color:var(--ztd-destructive)]',
  '[&_ins]:bg-[color-mix(in_srgb,_var(--ztd-success)_18%,_transparent)] [&_ins]:text-foreground',
  '[&_ins]:underline [&_ins]:[text-decoration-color:var(--ztd-success)]',
].join(' ')

export const layout12Class = [
  'diff-value-scroll max-h-[22rem] [&_.ztd-scroll-viewport]:max-h-[22rem] [&_pre]:m-0',
  '[&_pre]:font-[inherit] [&_pre]:text-[length:14px] [&_pre]:leading-[1.75]',
  '[&_pre]:whitespace-pre-wrap [&_pre]:wrap-anywhere',
].join(' ')

export const layout13Class = [
  'diff-group-heading flex items-center [&_>_.ztd-badge]:text-muted-foreground',
  '[&_>_.ztd-badge]:text-[length:12px] justify-start gap-2 m-0 text-[length:13px] font-medium',
].join(' ')
