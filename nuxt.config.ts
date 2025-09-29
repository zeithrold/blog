import fonts from './scripts/google-fonts.mjs'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@vueuse/nuxt',
    '@nuxtjs/robots',
    'nitro-cloudflare-dev',
  ],

  app: {
    head: {
      title: 'Candy V3',
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
        minify: true,
      },
    },
  },

  eslint: {
    config: {
      standalone: false,
    },
  },

  image: {
    provider: 'ipxStatic',
  },

  robots: {
    blockAiBots: true,
    blockNonSeoBots: true,
  },
})
