import antfu from '@antfu/eslint-config'
import next from '@next/eslint-plugin-next'
import drizzle from 'eslint-plugin-drizzle'
import readableTailwind from 'eslint-plugin-readable-tailwind'

export default antfu({
  formatters: true,
  react: true,
})
  .append({
    name: 'drizzle',
    plugins: {
      drizzle,
    },
    rules: drizzle.configs.recommended.rules,
  })
  .append({
    name: 'readable-tailwind',
    plugins: {
      'readable-tailwind': readableTailwind,
    },
    rules: readableTailwind.configs.error.rules,
  })
  .append({
    plugins: {
      '@next/next': next,
    },
    name: 'next/recommended',
    rules: next.configs.recommended.rules,
  })
  .append({
    plugins: {
      '@next/next': next,
    },
    name: 'next/core-web-vitals',
    rules: next.configs['core-web-vitals'].rules,
  })
