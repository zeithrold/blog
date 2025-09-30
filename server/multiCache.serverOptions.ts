import { defineMultiCacheOptions } from 'nuxt-multi-cache/server-options'
import cloudflareKVBinding from 'unstorage/drivers/cloudflare-kv-binding'

export default defineMultiCacheOptions(() => ({
  route: {
    storage: {
      driver: cloudflareKVBinding({
        binding: 'KV',
        base: 'data:',
      }),
    },
  },

  component: {
    storage: {
      driver: cloudflareKVBinding({
        binding: 'KV',
        base: 'component:',
      }),
    },
  },

  cdn: {
    storage: {
      driver: cloudflareKVBinding({
        binding: 'KV',
        base: 'cdn:',
      }),
    },
  },

  cacheKeyPrefix: 'v1:multi-cache:',
}))
