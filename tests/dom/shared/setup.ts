import { afterEach } from 'vitest'
import { resetFetch } from './http'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

afterEach(resetFetch)
