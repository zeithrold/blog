// @ts-check
import antfu from '@antfu/eslint-config'
import nextPlugin from '@next/eslint-plugin-next'
import rules from './scripts/eslint-rules.mjs'

export default antfu(
  {
    react: true,
    typescript: {
      tsconfigPath: './tsconfig.json',
    },
    formatters: true,
    rules,
    ignores: [
      '.next/**',
      '.open-next/**',
      'node_modules/**',
      'next-env.d.ts',
      'styles/globals.css',
      'components/ui/**',
    ],
  },
  {
    plugins: {
      next: nextPlugin,
    },
    // @ts-ignore
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
)
