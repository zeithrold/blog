export const layout1Class = [
  'admin-page max-w-290 my-0 mx-auto pt-9 px-[max(40px,_env(safe-area-inset-left))] pb-18',
  'max-[1023.99px]:px-6 max-[639.99px]:pt-8 max-[639.99px]:px-4 max-[639.99px]:pb-14',
].join(' ')

export const layout2Class = [
  'admin-heading flex flex-wrap items-end justify-between gap-y-4 gap-x-6 mb-7 [&_.eyebrow]:mb-3',
  '[&_h1]:text-[length:28px] [&_h1]:font-semibold [&_h1]:tracking-[-0.025em] [&_h1]:leading-[1.25]',
  '[&_.admin-description]:mt-3 [&_.admin-description]:mx-0 [&_.admin-description]:mb-0',
  'max-[701px]:[&_.eyebrow]:mb-[6px] max-[701px]:[&_.admin-description]:mt-2 max-[701px]:gap-4',
].join(' ')

export const layout3Class = [
  'm-0 text-[clamp(44px,6vw,68px)] font-medium tracking-[-0.045em] leading-[1.08]',
  '[html:lang(zh-CN)_&]:tracking-[-0.02em] [html:lang(zh-CN)_&]:leading-[1.2]',
].join(' ')

export const layout4Class = [
  'admin-note flex items-start gap-[10px] mt-6 mx-0 mb-0 py-[14px] px-4 rounded-[12px]',
  'bg-[color-mix(in_srgb,_var(--ztd-muted)_60%,_transparent)] text-muted-foreground text-help',
  'leading-[1.7] [&_svg]:mt-[3px]',
].join(' ')

export const layout5Class = [
  'operation-health [&_h2]:m-0 [&_h2]:text-[length:15px] [&_h2]:font-medium flex items-center',
  'gap-[14px] py-4 px-5 border border-border rounded-[12px] bg-card',
  '[&_>_svg]:text-[var(--ztd-success)] [&[data-state=warning]_>_svg]:text-[var(--ztd-warning)]',
  '[&_p]:mt-1 [&_p]:mx-0 [&_p]:mb-0 [&_p]:text-muted-foreground [&_p]:text-help',
  'max-[701px]:flex-wrap',
].join(' ')

export const layout6Class = [
  'operation-generation ml-auto text-muted-foreground text-help whitespace-nowrap',
  'max-[701px]:w-full max-[701px]:ml-[34px]',
].join(' ')

export const layout7Class = [
  'notice [&_button]:mt-2 [&_button]:mr-2 [&_button]:mb-0 [&_button]:ml-0 my-4 mx-0 py-3 px-4',
  'border border-border rounded-[12px] bg-card text-help leading-[1.6]',
].join(' ')

export const layout8Class = [
  'stat flex flex-col gap-2 py-[18px] px-5 border border-border rounded-[12px] bg-card [&_dt]:flex',
  '[&_dt]:items-center [&_dt]:gap-2 [&_dt]:text-muted-foreground [&_dt]:text-help',
  '[&_dt]:font-medium [&[data-state=warning]_dt::before]:bg-[var(--ztd-warning)] [&_dd]:flex',
  '[&_dd]:flex-col [&_dd]:gap-1 [&_dd]:m-0 [&[data-state=critical]_dt]:text-destructive',
  '[&[data-state=critical]_dt::before]:bg-destructive',
].join(' ')
