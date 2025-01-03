import type { Error } from '..'

export default function unknown(stack: unknown): Error {
  return {
    id: 'unknown_error',
    description: 'An unknown error occurred',
    stack,
    status: 500,
    internal: true,
  }
}
