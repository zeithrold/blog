import type { Config } from 'vike/types'
import config from 'vike-solid/config'

export default {
  extends: config,
  ssr: true,
  clientRouting: false,
} satisfies Config
