export default {
  files: ['src/app/**/*.css', 'src/components/ui/ztd-me/**/*.css'],
  classFiles: [
    'src/**/*.tsx',
    'src/**/*-layout.ts',
    'src/**/*-utilities.ts',
  ],
  tokenFiles: ['node_modules/tailwindcss/theme.css'],
  externalCustomProperties: [
    '--radix-select-content-available-height',
    '--radix-dropdown-menu-content-transform-origin',
    '--radix-select-content-transform-origin',
    '--radix-select-trigger-width',
    '--radix-popover-trigger-width',
    '--radix-popover-content-available-height',
    '--initial-transform',
    '--snap-point-height',
    '--swipe-amount',
  ],
}
