/// <reference types="#shared/worker-configuration" />

import type { H3EventContext as OriginalH3EventContext } from 'h3'

declare module 'h3' {
  interface H3EventContext extends OriginalH3EventContext {
    cf: CfProperties
    cloudflare: {
      request: Request
      env: Env
      context: ExecutionContext
    }
  }
}
