import tailwindcss from '@tailwindcss/vite'
import fonts from './scripts/google-fonts.mjs'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/css/tailwind.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@vueuse/nuxt',
    '@nuxtjs/robots',
    'nitro-cloudflare-dev',
    'shadcn-nuxt',
    '@nuxt/scripts',
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
      },
    },
  },
})
