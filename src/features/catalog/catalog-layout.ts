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
  'catalog-layout grid grid-cols-[minmax(0,_1fr)_340px] [align-items:start] gap-6',
  'max-[960px]:grid-cols-[minmax(0,_1fr)]',
].join(' ')

export const layout5Class = [
  'catalog-list [&_li]:relative [&_li]:flex [&_li]:items-center [&_li]:gap-[14px] [&_li]:min-h-15',
  '[&_li]:pt-2 [&_li]:pr-3 [&_li]:pb-2 [&_li]:pl-5 [&_li_+_li]:border-t [&_li_+_li]:border-border',
  'm-0 p-0 list-none max-[701px]:[&_li]:flex-wrap max-[701px]:[&_li]:gap-[10px]',
  'max-[701px]:[&_li]:px-0 overflow-hidden border border-border rounded-[12px] bg-card',
  '[&:empty]:hidden [&_li:hover]:bg-[var(--admin-hover)]',
].join(' ')

export const layout6Class = [
  'visually-hidden absolute w-px h-px m-[-1px] p-0 overflow-hidden [clip-path:inset(50%)]',
  'whitespace-nowrap border-0',
].join(' ')

export const layout7Class = [
  'catalog-icon flex shrink-0 items-center justify-center w-8 h-8 rounded-[8px] bg-muted',
  'text-muted-foreground',
].join(' ')

export const layout8Class = [
  'catalog-entry grid flex-1 gap-1 min-w-0 wrap-anywhere [&_strong]:m-0',
  '[&_strong]:text-[length:15px] [&_strong]:font-medium [&_span]:text-muted-foreground',
  '[&_span]:text-help max-[701px]:basis-[calc(100%_-_50px)]',
].join(' ')

export const layout9Class = [
  'status-badge [&[data-state=deleted]]:text-destructive inline-flex items-center',
  '[place-self:start] gap-[6px] w-[fit-content] max-w-full py-[2px] px-2 border border-transparent',
  'rounded-full bg-[color-mix(in_srgb,_currentcolor_10%,_transparent)]',
  'text-[color-mix(in_srgb,_var(--ztd-muted-foreground)_80%,_var(--ztd-foreground))] text-help',
  'font-medium leading-[20px] wrap-anywhere whitespace-nowrap',
  '[&[data-state=live]]:text-[var(--ztd-success)]',
  '[&[data-state=changed]]:text-[var(--ztd-warning)]',
].join(' ')

export const layout10Class = [
  'admin-form [&_h2]:m-0 [&_h2]:text-[length:15px] [&_h2]:font-medium sticky',
  'top-[calc(var(--admin-appbar-height)_+_24px)] grid gap-4 p-5 border border-border rounded-[12px]',
  'bg-card text-help [&_.editor-field-help]:mt-[-8px] [&_.editor-field-help]:mx-0',
  '[&_.editor-field-help]:mb-0 [&_.notice]:m-0',
].join(' ')

export const layout11Class = [
  'notice notice-error [&_button]:mt-2 [&_button]:mr-2 [&_button]:mb-0 [&_button]:ml-0 my-4 mx-0',
  'py-3 px-4 border rounded-[12px] text-help leading-[1.6]',
  'border-[color-mix(in_srgb,_var(--ztd-destructive)_40%,_var(--ztd-border))]',
  'bg-[color-mix(in_srgb,_var(--ztd-destructive)_7%,_var(--ztd-surface))]',
].join(' ')
