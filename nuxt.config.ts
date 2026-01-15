import tailwindcss from '@tailwindcss/vite'
import fonts from './scripts/google-fonts.mjs'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/tailwind.css'],

  typescript: {
    tsConfig: {
      include: [
        '../sentry.client.config.ts',
        '../sentry.server.config.ts',
      ],
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  site: {
    name: '@Zeithrold/Blog',
    description: 'Ahead Every Moment - @Zeithrold/Blog',
  },

  seo: {
    meta: {
      author: 'Zeithrold',
    },
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@vueuse/nuxt',
    '@nuxtjs/seo',
    'nitro-cloudflare-dev',
    'shadcn-nuxt',
    '@nuxt/scripts',
    '@sentry/nuxt/module',
  ],

  app: {
    rootAttrs: {
      id: '__zeithrold',
    },
    head: {
      link: [
        { href: fonts, rel: 'stylesheet' },
        { href: 'https://fonts.googleapis.com', rel: 'preconnect' },
        { href: 'https://fonts.gstatic.com', rel: 'preconnect', crossorigin: '' },
      ],
    },
  },

  nitro: {
    experimental: {
      wasm: true,
    },
    preset: 'cloudflare_module',
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
      wrangler: {
      },
    },
    storage: {
      cache: {
        driver: 'cloudflare-kv-binding',
        binding: 'KV',
        base: 'cache:',
      },
    },
  },

  eslint: {
    config: {
      standalone: false,
    },
  },

  image: {
    provider: 'ipx',
  },

  robots: {
    blockAiBots: true,
    blockNonSeoBots: true,
  },

  shadcn: {
    prefix: 'ui',
  },

  runtimeConfig: {
    notion: {
      token: '',
      datasourceId: '',
      fields: {
        tag: '',
        draft: '',
      },
    },
  },

  sentry: {
    org: 'zeithrold',
    project: 'blog',
    autoInjectServerSentry: 'top-level-import',
  },

  sourcemap: {
    client: 'hidden',
  },
})
