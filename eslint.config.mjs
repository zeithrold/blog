// @ts-check
import antfu from '@antfu/eslint-config'
import { withNuxt } from './.nuxt/eslint.config.mjs'
import rules from './scripts/eslint-rules.mjs'

export default withNuxt(
  // Your custom configs here
  antfu({
    typescript: {
      tsconfigPath: './tsconfig.json',
    },
    vue: true,
    formatters: true,
    rules,
    ignores: ['app/components/ui/**'],
  }),
)
