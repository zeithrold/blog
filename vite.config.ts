import devServer from '@hono/vite-dev-server'
import mdx from '@mdx-js/rollup'
import devtools from 'solid-devtools/vite'
import vikeSolid from 'vike-solid/vite'
import vike from 'vike/plugin'
import { defineConfig } from 'vite'
import banner from 'vite-plugin-banner'
import vercel from 'vite-plugin-vercel'
import paths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    vike(),
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
    banner('POWERED BY ZEITHROLD | 2024 Zeithrold https://github.com/zeithrold/blog'),
    vercel(),
  ],
  build: {
    rollupOptions: {
      treeshake: 'recommended',
    },
  },
  vercel: {
    additionalEndpoints: [
      {
        source: './src/server/vercel.ts',
        destination: 'ssr_',
        route: true,
        buildOptions: {
          minify: true,
          treeShaking: true,
          bundle: true,
        },
      },
    ],
  },
})
