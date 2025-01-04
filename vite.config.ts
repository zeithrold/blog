import process from 'node:process'
import devServer from '@hono/vite-dev-server'
import mdx from '@mdx-js/rollup'
import devtools from 'solid-devtools/vite'
import { pages } from 'vike-cloudflare'
import vikeSolid from 'vike-solid/vite'
import vike from 'vike/plugin'
import { defineConfig } from 'vite'
import banner from 'vite-plugin-banner'
import paths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    vike({
      prerender: false,
    }),
    pages(),
    devServer({
      entry: './src/server/entry.ts',
      exclude: [
        /^\/@.+$/,
        /.*\.(ts|tsx|vue)($|\?)/,
        /.*\.(s?css|less)($|\?)/,
        /^\/favicon\.ico$/,
        /.*\.(svg|png)($|\?)/,
        /^\/(public|assets|static)\/.+/,
        /^\/node_modules\/.*/,
        /.*\.(mdx?)($|\?)/,
      ],
      injectClientScript: false,
    }),
    {
      enforce: 'pre',
      ...mdx({
        jsxImportSource: 'solid-jsx',
      }),
    },
    vikeSolid(),
    paths(),
    devtools({
      autoname: true,
    }),
    banner('2025 Zeithrold https://github.com/zeithrold/blog | Licensed under MIT'),
  ],
  build: {
    rollupOptions: {
      treeshake: 'recommended',
      output: {
        entryFileNames: 'assets/entries/entry-[hash].js',
        chunkFileNames: 'assets/chunks/chunk-[hash].js',
      },
    },
  },
})
