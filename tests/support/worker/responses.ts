import { z } from 'zod'
import { acknowledgementSchema } from '@/contracts/documents'
import { equal } from '~/tests/support/unit/assertions'

type JsonResponse = {
  status: number
  clone: () => { text: () => Promise<string> }
  json: () => Promise<unknown>
}
type Parser<T> = { parse: (value: unknown) => T }

export function json(response: JsonResponse, status?: number): Promise<ReturnType<typeof acknowledgementSchema.parse>>
export function json<T>(response: JsonResponse, status: number, schema: Parser<T>): Promise<T>
export async function json(
  response: JsonResponse,
  status = 200,
  schema: Parser<unknown> = acknowledgementSchema,
): Promise<unknown> {
  equal(response.status, status, await response.clone().text())
  return schema.parse(await response.json())
}

/** Asserts a problem refusal and returns its code, so a case names the rule that refused it. */
export async function refusal(response: JsonResponse, status: number): Promise<string> {
  equal(response.status, status, await response.clone().text())
  return z.object({ code: z.string() }).parse(await response.json()).code
}
