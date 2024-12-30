import process from 'node:process'
import devServer from '@hono/vite-dev-server'
import mdx from '@mdx-js/rollup'
import devtools from 'solid-devtools/vite'
import vikeSolid from 'vike-solid/vite'
import vike from 'vike/plugin'
import { defineConfig } from 'vite'
import banner from 'vite-plugin-banner'
import vercel from 'vite-plugin-vercel'
import paths from 'vite-tsconfig-paths'

const isProcution = process.env.NODE_ENV === 'production'
const baseAssets = isProcution ? 'https://r2.zeithrold.dev/blog' : undefined

export default defineConfig({
  plugins: [
    vike({
      baseAssets,
      prerender: false,
    }),
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
    banner('2024 Zeithrold https://github.com/zeithrold/blog | Licensed under MIT'),
    vercel(),
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
  vercel: {
    additionalEndpoints: [
      {
        source: './src/server/vercel.ts',
        destination: 'ssr_',
        route: false,
        buildOptions: {
          minify: true,
          treeShaking: true,
          bundle: true,
        },
      },
    ],
  },
})
