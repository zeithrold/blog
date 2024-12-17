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
    mdx({
      jsxImportSource: 'solid-jsx',
    }),
    vikeSolid(),
    paths(),
    devtools({
      autoname: true,
    }),
    banner('POWERED BY ZEITHROLD | 2024 Zeithrold https://github.com/zeithrold/blog'),
    vercel(),
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
      ],
    }),
  ],
  build: {
    rollupOptions: {
      treeshake: 'recommended',
    },
  },
  vercel: {
    additionalEndpoints: [
      {
        // entry file to the server. Default export must be a node server or a function
        source: './src/server/vercel.ts',
        // replaces default Vike target
        destination: 'ssr_',
        // already added by default Vike route
        route: false,
        buildOptions: {
          minifySyntax: true,
          minifyWhitespace: true,
          minifyIdentifiers: true,
          treeShaking: true,
          bundle: true,
        },
      },
    ],
  },
})
