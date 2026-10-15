export const layout1Class = [
  'inspector-mobile fixed z-[15] right-4 bottom-[max(16px,_env(safe-area-inset-bottom))] m-0',
  '[&_>_button]:shadow-[0_6px_20px_var(--blog-shadow-overlay)] max-[1100px]:[align-self:flex-end]',
].join(' ')

export const layout2Class = [
  'inspector-drawer flex flex-col gap-0 w-full max-w-full h-[90dvh] max-h-[90dvh] overflow-clip p-0',
  '[&_[data-slot=drawer-handle]]:mt-3 [&_[data-slot=drawer-handle]]:shrink-0',
  '[&_.inspector-tabs]:flex-1 [&_.inspector-tabs]:h-auto [&_.inspector-tabs]:px-6',
  '[&_.inspector-scroll]:mx-[-24px] [&_.inspector-scroll_[role=tabpanel]]:pt-5',
  '[&_.inspector-scroll_[role=tabpanel]]:px-6 [&_.inspector-scroll_[role=tabpanel]]:pb-8',
  'max-[380px]:[&_[role=tab]]:px-1 max-[380px]:[&_[role=tab]_svg]:hidden',
].join(' ')

export const layout3Class = [
  'inspector-drawer-footer shrink-0 pt-4 px-6 pb-[max(16px,_env(safe-area-inset-bottom))] border-t',
  'border-border bg-background',
].join(' ')

export const layout4Class = [
  'document-settings sticky top-[calc(var(--admin-appbar-height)_+_var(--admin-header-height))]',
  'grid [grid-template-rows:auto_minmax(0,_1fr)] [align-content:start] gap-4 min-w-0',
  'h-[calc(100dvh_-_var(--admin-appbar-height)_-_var(--admin-header-height))] pt-5 px-5 pb-0',
  'border-l border-border bg-[var(--admin-sidebar-background)] text-control [&_h2]:m-0',
  '[&_h2]:text-control [&_h2]:font-semibold [&_>_label]:text-help [&_>_label]:font-medium',
  '[&_>_a]:inline-flex [&_>_a]:items-center [&_>_a]:[justify-self:start] [&_>_a]:min-h-11',
  '[&_>_a]:text-help [&_>_a]:font-medium [&_input]:bg-card [&_select]:bg-card [&_textarea]:bg-card',
  'max-[1100px]:border-t max-[1100px]:border-border max-[1100px]:border-l-0 max-[701px]:pt-6',
  'max-[701px]:px-4 max-[701px]:pb-10',
].join(' ')

export const layout5Class = [
  'inspector-tabs flex flex-col min-h-0 h-full overflow-clip [&_>_[role=tablist]]:flex',
  '[&_>_[role=tablist]]:shrink-0 [&_>_[role=tablist]]:w-full [&_>_[role=tablist]]:gap-[2px]',
  '[&_[role=tab]]:flex-[1_1_auto] [&_[role=tab]]:min-w-0 [&_[role=tab]]:gap-[6px]',
  '[&_[role=tab]]:px-2 [&_[role=tab]]:text-control',
  '[&_[role=tabpanel][data-state=inactive]]:hidden',
].join(' ')

export const layout6Class = [
  'inspector-scroll flex-1 min-h-0 mt-1 mx-[-20px] [&_[role=tabpanel]]:pt-4',
  '[&_[role=tabpanel]]:px-5 [&_[role=tabpanel]]:pb-8',
  '[&_.ztd-scroll-viewport]:[overscroll-behavior-y:contain]',
  '[&_.ztd-scroll-viewport]:[touch-action:pan-y]',
].join(' ')

export const editorSectionClass = [
  'editor-section [&_details]:pt-[2px] [&_details]:border-t [&_details]:border-border',
  '[&_details_>_summary]:text-help [&_details[open]]:grid [&_details[open]]:gap-3',
  '[&_details[open]]:pb-2 grid gap-5 py-[0_28px] mb-7 border-b border-border [&_label]:gap-2',
  '[&_label:not(.checkbox-field)]:text-muted-foreground [&_label:not(.checkbox-field)]:text-help',
  '[&_label:not(.checkbox-field)]:font-medium [&_label:not(.checkbox-field)]:leading-[1.6]',
  '[&_.ztd-label:not(.checkbox-field)]:grid [&_fieldset]:grid',
  '[&_fieldset]:gap-4 [&_fieldset]:p-[18px] [&_fieldset_>_label]:mt-0 [&:last-child]:border-b-0',
  '[&_>_[data-state]]:min-w-0 [&_fieldset]:min-w-0 [&_[role=region]]:grid',
  '[&_[role=region]]:gap-3',
].join(' ')
