import type { UserConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import vinext from 'vinext'
import { defineConfig } from 'vite'
import { developmentLogin } from './tests/development/login-plugin'

export default defineConfig(async ({ command, isPreview }): Promise<UserConfig> => {
  const login = command === 'serve' && isPreview !== true ? await developmentLogin() : undefined
  return {
    resolve: { tsconfigPaths: true, alias: login?.aliases },
    worker: { format: 'iife', rollupOptions: { output: { inlineDynamicImports: true } } },
    plugins: [
      ...(login !== undefined ? [login.plugin] : []),
      tailwindcss(),
      vinext(),
      cloudflare({
        ...(login !== undefined ? { config: login.config, remoteBindings: false } : {}),
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      }),
    ],
  }
})
