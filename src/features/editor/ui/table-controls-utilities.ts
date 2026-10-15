// Keep the native table node view and resize handles; only its inner viewport scrolls.
export const tableCanvasClass = [
  'min-[701px]:[&_.bn-editor]:pl-16',
  'max-[701px]:[&_.bn-editor]:pr-4',
  'max-[701px]:[&_.bn-editor]:pl-4',
  'max-[701px]:[&_.bn-editor>.bn-block-group>.bn-block-outer+.bn-block-outer]:mt-12',
  'max-[701px]:[&_.bn-editor>.bn-block-group]:pb-12',
  '[&_[data-content-type=table]_.tableWrapper]:overflow-visible',
  '[&_[data-content-type=table]_.tableWrapper]:min-w-0',
  '[&_[data-content-type=table]_.tableWrapper]:max-w-full',
  '[&_[data-content-type=table]_.tableWrapper]:pt-10',
  '[&_[data-content-type=table]_.tableWrapper]:pr-0',
  '[&_[data-content-type=table]_.tableWrapper]:pb-7',
  '[&_[data-content-type=table]_.tableWrapper]:pl-0',
  'max-[701px]:[&_[data-content-type=table]_.tableWrapper]:pt-20',
  'max-[701px]:[&_[data-content-type=table]_.tableWrapper]:pl-2',
  'max-[701px]:[&_[data-content-type=table]_tr]:h-11',
  '[&_[data-content-type=table]_.tableWrapper-inner]:min-w-0',
  '[&_[data-content-type=table]_.tableWrapper-inner]:max-w-full',
  '[&_[data-content-type=table]_.tableWrapper-inner]:overflow-x-auto',
  '[&_[data-content-type=table]_.tableWrapper-inner]:overscroll-x-contain',
  '[&_[data-content-type=table]_.tableWrapper-inner]:[scrollbar-width:none]',
  '[&_[data-content-type=table]_.tableWrapper-inner::-webkit-scrollbar]:hidden',
  '[&_[data-content-type=table]_td]:border-border',
  '[&_[data-content-type=table]_th]:border-border',
  '[&_[data-content-type=table]_table]:min-w-[var(--editor-table-width,0px)]',
].join(' ')

export const tableScrollbarClass = [
  'editor-table-scrollbar absolute top-2 left-0 h-3 touch-none rounded-full bg-muted select-none',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus max-[701px]:h-5',
].join(' ')

export const tableBarClass = [
  'absolute flex rounded-lg border border-border bg-muted/70 font-sans text-muted-foreground',
  'transition-opacity duration-150 motion-reduce:transition-none',
].join(' ')

export const tableSegmentClass = [
  'flex shrink-0 items-center justify-center rounded-none border-0 p-0',
  'text-muted-foreground/60 hover:bg-muted hover:text-foreground data-[state=open]:bg-muted',
  'data-[state=open]:text-foreground focus-visible:bg-muted focus-visible:text-foreground',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
  'disabled:opacity-50',
].join(' ')

export const tableDisabledItemClass = 'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'

export const tableInsertClass = [
  'absolute z-10 flex size-6 items-center justify-center rounded-full border border-border bg-surface shadow-sm',
  'text-muted-foreground opacity-0 pointer-events-none transition-opacity duration-150',
  'hover:text-foreground focus-visible:opacity-100 focus-visible:pointer-events-auto',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  'motion-reduce:transition-none max-[701px]:size-11',
].join(' ')
