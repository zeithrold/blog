import antfu from '@antfu/eslint-config'
import drizzle from 'eslint-plugin-drizzle'
import readableTailwind from 'eslint-plugin-readable-tailwind'

export default antfu({
  formatters: true,
  solid: true,
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
})
  .append({
    plugins: {
      drizzle,
    },
    rules: drizzle.configs.recommended.rules,
  })
  .append({
    plugins: {
      'readable-tailwind': readableTailwind,
    },
    rules: readableTailwind.configs.error.rules,
  })
