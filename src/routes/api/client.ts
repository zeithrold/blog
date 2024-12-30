import type { Hono } from 'hono'
import { hc } from 'hono/client'

export function client<T extends Hono<any, any, any>>(url: string) {
  return hc<T>(`/v1/api${url}`)
}
