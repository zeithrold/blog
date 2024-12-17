import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'
import daisyui from 'daisyui'

export default {
  content: ['./src/**/*.{html,js,jsx,ts,tsx,vue}'],
  theme: {
    extend: {},
  },
  plugins: [daisyui, typography],
} satisfies Config
