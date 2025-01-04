/**
 * This file contains the internal error handling logic for the application.
 * Functions included just returns a new `TRPCError` instance with the appropriate error code.
 * but with a log message to the console to debug.
 */

import type { TaskEitherError } from './helper/types'
import { TRPCError } from '@trpc/server'
import { DrizzleError } from 'drizzle-orm'
import * as E from 'fp-ts/Either'
// import { PostgresError } from 'postgres' is not available in the current environment
import pg from 'postgres'

function log(message: unknown) {
  if (typeof message === 'string') {
    console.error(`[ZEITHROLD] ${message}`)
    return
  }
  console.error('[ZEITHROLD]')
  console.error(message)
}

export function database(error: unknown) {
  if (error instanceof pg.PostgresError) {
    log(`PostgresError: "${error.code}": "${error.message}", detail: "${error.detail}"`)
    log(error.query)
    log(JSON.stringify(error))
  }
  else if (error instanceof DrizzleError) {
    log(`DrizzleError: "${error.name}": "${error.message}"`)
  }
  else {
    log(`Unknown database error`)
    log(error)
  }
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
  })
}
