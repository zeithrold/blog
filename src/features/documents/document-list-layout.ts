export const layout1Class = [
  'admin-page admin-documents max-w-290 my-0 mx-auto pt-9 px-[max(40px,_env(safe-area-inset-left))]',
  'pb-18 max-[1023.99px]:px-6 max-[639.99px]:pt-8 max-[639.99px]:px-4 max-[639.99px]:pb-14',
  'data-[trash=true]:[--document-action-width:128px]',
].join(' ')

export const layout2Class = [
  'document-list-panel overflow-hidden border border-border rounded-[12px] bg-card',
  '[&_.document-list]:border-0 [&_.document-list]:rounded-none [&_.empty-state]:border-0',
  '[&_.empty-state]:rounded-none',
].join(' ')

export const layout3Class = [
  'admin-heading flex flex-wrap items-end justify-between gap-y-4 gap-x-6 mb-7 [&_.eyebrow]:mb-3',
  '[&_h1]:text-[length:28px] [&_h1]:font-semibold [&_h1]:tracking-[-0.025em] [&_h1]:leading-[1.25]',
  '[&_.admin-description]:mt-3 [&_.admin-description]:mx-0 [&_.admin-description]:mb-0',
  'max-[701px]:[&_.eyebrow]:mb-[6px] max-[701px]:[&_.admin-description]:mt-2 max-[701px]:gap-4',
].join(' ')

export const layout4Class = [
  'm-0 text-[clamp(44px,6vw,68px)] font-medium tracking-[-0.045em] leading-[1.08]',
  '[html:lang(zh-CN)_&]:tracking-[-0.02em] [html:lang(zh-CN)_&]:leading-[1.2]',
].join(' ')

export const layout5Class = [
  'notice notice-error document-list-error [&_button]:mt-2 [&_button]:mr-2 [&_button]:mb-0',
  '[&_button]:ml-0 my-4 mx-0 py-3 px-4 border rounded-[12px] text-help leading-[1.6]',
  'border-[color-mix(in_srgb,_var(--ztd-destructive)_40%,_var(--ztd-border))]',
  'bg-[color-mix(in_srgb,_var(--ztd-destructive)_7%,_var(--ztd-surface))]',
].join(' ')

export const layout7Class = [
  'empty-state document-empty flex items-start gap-4 p-6 [border:1px_dashed_var(--ztd-border)]',
  'rounded-[12px] [&_p]:m-0 [&_p]:text-muted-foreground [&_p]:text-help [&_p]:leading-[1.7]',
  '[&_.empty-title]:mt-0 [&_.empty-title]:mx-0 [&_.empty-title]:mb-[2px]',
  '[&_.empty-title]:text-foreground [&_.empty-title]:text-[length:15px]',
  '[&_.empty-title]:font-medium max-[701px]:p-[22px]',
].join(' ')

export const layout8Class = [
  'document-list-columns grid items-center gap-4',
  'grid-cols-[minmax(0,_1fr)_64px_165px_115px_var(--document-action-width,100px)]',
  'px-5 min-h-10 border-b border-border',
  'bg-[color-mix(in_srgb,_var(--ztd-muted)_40%,_var(--ztd-surface))] text-muted-foreground',
  'text-help font-medium max-[960px]:grid-cols-[minmax(0,_1fr)_60px_150px_var(--document-action-width,85px)]',
  'max-[960px]:[&_>_:nth-child(4)]:hidden max-[701px]:hidden',
  'min-[960.01px]:grid-cols-[minmax(0,_1fr)_128px_200px_120px_var(--document-action-width,44px)]',
].join(' ')

export const layout9Class = [
  'document-list m-0 p-0 overflow-hidden border border-border rounded-[16px] bg-card list-none',
  '[&_li]:relative [&_li]:grid [&_li]:grid-cols-[minmax(0,_1fr)_72px_170px_110px]',
  '[&_li]:items-center [&_li]:gap-4 [&_li]:min-h-15 [&_li]:py-2 [&_li]:px-5',
  '[&_li]:[transition:background-color_0.12s] [&_li_+_li]:border-t [&_li_+_li]:border-border',
  '[&_li:hover]:bg-[var(--admin-hover)] [&_li.document-row]:grid',
  '[&_li.document-row]:grid-cols-[minmax(0,_1fr)_64px_165px_115px_var(--document-action-width,100px)]',
  '[&_li.document-row]:items-center [&_li.document-row]:gap-4 [&_li.document-row]:px-5',
  'max-[960px]:[&_li.document-row]:grid-cols-[minmax(0,_1fr)_60px_150px_var(--document-action-width,85px)]',
  'max-[701px]:[&_li.document-row]:flex',
  'min-[960.01px]:[&_li.document-row]:grid-cols-[minmax(0,_1fr)_128px_200px_120px_var(--document-action-width,44px)]',
  'max-[960px]:[&_li]:grid-cols-[minmax(0,_1fr)_64px_150px] max-[701px]:[&_li]:flex',
  'max-[701px]:[&_li]:flex-wrap max-[701px]:[&_li]:gap-y-1 max-[701px]:[&_li]:gap-x-[14px]',
  'max-[701px]:[&_li]:pt-[10px] max-[701px]:[&_li]:px-4 max-[701px]:[&_li]:pb-[14px]',
].join(' ')

export const layout10Class = [
  'document-row [&_.document-restore]:relative [&_.document-restore]:z-[1]',
  '[&_.document-publication]:relative [&_.document-publication]:z-[1]',
].join(' ')

export const layout11Class = [
  'document-row-icon flex shrink-0 items-center justify-center w-8 h-8 rounded-[8px] bg-muted',
  'text-muted-foreground',
].join(' ')

export const layout12Class = [
  'document-title flex items-center min-w-0 min-h-11 text-control font-medium no-underline',
  'wrap-anywhere',
  'max-[701px]:basis-full',
].join(' ')

export const layout13Class = [
  'document-title flex items-center min-w-0 min-h-11 text-control font-medium no-underline',
  'wrap-anywhere hover:underline',
  'hover:[text-decoration-color:color-mix(in_srgb,_currentcolor_35%,_transparent)]',
  'max-[701px]:basis-full',
].join(' ')

export const layout14Class = [
  'status-badge [&[data-state=deleted]]:text-destructive inline-flex items-center',
  '[place-self:start] gap-[6px] w-[fit-content] max-w-full py-[2px] px-2 border border-transparent',
  'rounded-full bg-[color-mix(in_srgb,_currentcolor_10%,_transparent)]',
  'text-[color-mix(in_srgb,_var(--ztd-muted-foreground)_80%,_var(--ztd-foreground))] text-help',
  'font-medium leading-[20px] wrap-anywhere whitespace-nowrap',
  '[&[data-state=live]]:text-[var(--ztd-success)]',
  '[&[data-state=changed]]:text-[var(--ztd-warning)]',
].join(' ')

export const layout15Class = [
  'document-updated text-muted-foreground text-help tabular-nums text-right max-[960px]:hidden',
  'max-[701px]:block max-[701px]:ml-auto',
].join(' ')

export const layout16Class = [
  'document-row-arrow inline-flex items-center justify-end gap-[6px] min-h-11 text-muted-foreground',
  'text-help no-underline max-[701px]:ml-auto',
].join(' ')

export const layout17Class = [
  'document-skeleton-row grid items-center gap-4 px-5 py-4',
  'grid-cols-[minmax(0,_1fr)_128px_200px_120px_44px]',
  '[&+&]:border-t [&+&]:border-border',
  'max-[960px]:grid-cols-[minmax(0,_1fr)_60px_150px_85px]',
  'max-[701px]:grid-cols-1 max-[701px]:gap-3 max-[701px]:px-4',
].join(' ')

export const layout18Class = [
  'visually-hidden absolute w-px h-px m-[-1px] p-0 overflow-hidden [clip-path:inset(50%)]',
  'whitespace-nowrap border-0',
].join(' ')
