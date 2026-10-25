import type { UserConfig } from 'vite'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = import.meta.dirname
const port = Number(process.env.BLOG_COMPONENT_TEST_PORT ?? 8830)
const runId = process.env.BLOG_COMPONENT_TEST_RUN_ID ?? 'manual'
// Build output is disposable and isolated per run and port; it never lands in
// the repository.
const outDir = path.join(tmpdir(), 'blog-component-tests', runId, String(port), 'dist')

export default defineConfig((): UserConfig => ({
  root,
  tsconfig: '../../tsconfig.json',
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: 'next/link',
        replacement: path.join(root, 'src/adapters/next-link.tsx'),
      },
      {
        find: 'next/navigation',
        replacement: path.join(root, 'src/adapters/next-navigation.ts'),
      },
    ],
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir,
    emptyOutDir: true,
  },
  preview: {
    host: '127.0.0.1',
    port,
    strictPort: true,
  },
}))
