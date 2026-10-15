export const mediaGridClass = [
  'grid grid-cols-[repeat(auto-fill,_minmax(min(280px,_100%),_1fr))] gap-3 m-0 p-0 list-none',
].join(' ')

export const mediaCardClass = [
  'group flex min-w-0 items-center overflow-hidden rounded-xl border border-border bg-card',
  'transition-colors hover:border-muted-foreground/40 focus-within:border-muted-foreground/60',
  'motion-reduce:transition-none',
].join(' ')

export const mediaMainClass = [
  'flex h-auto min-w-0 flex-1 items-center justify-start gap-3 rounded-none border-0 p-3',
  'text-left text-foreground whitespace-normal no-underline hover:bg-muted/60',
  'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus',
].join(' ')
