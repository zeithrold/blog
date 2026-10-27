import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      'next/link': path.join(import.meta.dirname, 'tests/dom/shared/link.tsx'),
      'next/navigation': path.join(import.meta.dirname, 'tests/dom/shared/link.tsx'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/dom/**/*.test.tsx'],
    setupFiles: ['tests/dom/shared/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
})
