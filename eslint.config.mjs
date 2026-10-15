import config from '@ztd-me/eslint'

export default config({
  ignores: [
    '.vinext/**',
    'dist/**',
    'next-env.d.ts',
    // Preserve the pinned upstream documentation example verbatim; runtime UI remains linted.
    'src/components/ui/ztd-me/README.md',
    'src/components/ui/ztd-me/foundation.md',
  ],
  react: { framework: 'vinext', appDir: 'src/app' },
  typescript: {
    tsconfigPath: 'tsconfig.json',
    tsconfigRootDir: import.meta.dirname,
  },
})
