import type { UserConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import vinext from 'vinext'
import { defineConfig } from 'vite'

export default defineConfig(({ command, isPreview }): UserConfig => {
  const development = command === 'serve' && isPreview !== true
  return {
    resolve: { tsconfigPaths: true },
    worker: { format: 'iife', rollupOptions: { output: { inlineDynamicImports: true } } },
    plugins: [
      tailwindcss(),
      vinext(),
      cloudflare({
        ...(development
          ? {
              config: config => ({
                vars: { ...config.vars, PUBLIC_ORIGIN: 'http://127.0.0.1:8800' },
              }),
              remoteBindings: false,
            }
          : {}),
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      }),
    ],
  }
})
