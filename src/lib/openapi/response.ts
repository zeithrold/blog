import type { ZodType } from 'zod'
import { ErrorResponseSchema, HeaderResponseSchema } from './schema'

export interface JsonResponseOptions<T extends ZodType> {
  schema: T
  status?: number
  description: string
}

export function json<T extends ZodType>({ schema, description, status = 200 }: JsonResponseOptions<T>) {
  return {
    [status.toString()]: {
      description,
      content: {
        'application/json': {
          schema,
        },
      },
    },
  }
}

export interface ErrorResponseOptions {
  description: string
  status: number
}

export function error({ description, status }: ErrorResponseOptions) {
  return {
    [status.toString()]: {
      description,
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  }
}

export interface RedirectResponseOptions {
  description: string
  status?: number
}

export function redirect({ description, status = 301 }: RedirectResponseOptions) {
  return {
    [status.toString()]: {
      description,
      headers: HeaderResponseSchema,
    },
  }
}

export function internal() {
  return {
    500: {
      description: 'Internal error occurred while processing the request.',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  }
}
