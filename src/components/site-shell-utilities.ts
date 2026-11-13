export const brandMarkClass = [
  'brand-mark flex flex-col justify-center gap-1 w-7 h-7 transform-[rotate(-12deg)]',
  '[&_span]:h-[3px] [&_span]:w-[25px] [&_span]:rounded-[3px] [&_span]:bg-accent-foreground',
  '[&_span:nth-child(2)]:w-[19px]',
].join(' ')

export const navClass = [
  'nav-link relative [isolation:isolate] inline-flex items-center justify-center gap-[6px] min-w-11',
  'min-h-11 py-0 px-2 text-foreground text-control leading-[var(--ztd-leading-help)] no-underline',
  'hover:text-foreground [&[aria-current=page]]:text-foreground [&:hover::before]:bg-muted',
  '[&[aria-current=page]::before]:bg-muted [&_svg]:text-[currentcolor]',
].join(' ')

export const navLabelClass = [
  'nav-label max-[641px]:absolute max-[641px]:w-px max-[641px]:h-px max-[641px]:m-[-1px]',
  'max-[641px]:overflow-hidden max-[641px]:[clip-path:inset(50%)] max-[641px]:whitespace-nowrap',
].join(' ')

export const brandClass = [
  'gap-3 max-[640px]:text-control max-[640px]:[&>.brand-mark]:hidden',
  'max-[640px]:shrink-0 max-[640px]:whitespace-nowrap max-[640px]:[&>span]:wrap-normal',
].join(' ')

export const publicChromeClass = [
  'max-[641px]:h-[55px] max-[641px]:min-h-[55px] max-[641px]:gap-2',
  'max-[641px]:[&>.ztd-actions]:gap-1 max-[641px]:[&>.ztd-actions>button]:hidden',
  'max-[641px]:[&_.nav-link_svg]:size-5 max-[641px]:[&_.brand-mark]:hidden',
  'max-[641px]:[&_.ztd-brand]:text-control',
].join(' ')
