import type { z } from 'zod'
import type { PublicationIssue } from '@/content/publication-issues'
import type { Acknowledgement } from '@/contracts/documents'
import { publicationIssueList } from '@/content/publication-issues'
import { acknowledgementSchema } from '@/contracts/documents'
import { sessionSchema } from '@/contracts/session'

export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    public issues: PublicationIssue[] = [],
  ) {
    super(code)
  }
}
export async function get<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted()
  const response = await fetch(path, {
    cache: 'no-store',
    signal,
  })
  return await read(response, schema)
}
export async function read<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const isJSON = response.headers.get('content-type')?.includes('json')
  if (!response.ok) {
    const problem: unknown = isJSON === true ? await response.json() : null
    throw apiFailure(response.status, problem)
  }
  if (!(isJSON === true)) {
    throw new APIError(502, 'CONNECTION_FAILED')
  }
  const value: unknown = await response.json()
  try {
    return schema.parse(value)
  }
  catch {
    throw new APIError(502, 'INVALID_RESPONSE')
  }
}
function apiFailure(status: number, problem: unknown): APIError {
  const code = problem !== null && typeof problem === 'object'
    && 'code' in problem && typeof problem.code === 'string'
    ? problem.code
    : 'CONNECTION_FAILED'
  const issues = publicationIssueList.safeParse(
    problem !== null && typeof problem === 'object' && 'issues' in problem ? problem.issues : [],
  )
  return new APIError(status, code, issues.success ? issues.data : [])
}

export class Client {
  private readonly pending = new Map<string, string>()
  constructor(public csrfToken: string, private readonly ownerSub?: string) {}

  async putBlob(path: string, body: Blob, type: string, signal?: AbortSignal): Promise<Response> {
    const send = async (): Promise<Response> => {
      signal?.throwIfAborted()
      return await fetch(path, {
        method: 'PUT',
        headers: { 'Content-Type': type, 'X-CSRF-Token': this.csrfToken },
        body,
        signal,
      })
    }
    let response = await send()
    if (response.status === 403 && (await csrfFailure(response))) {
      await this.refreshCsrf(signal)
      response = await send()
    }
    return response
  }

  async write(
    path: string,
    method: 'POST' | 'PUT' | 'DELETE',
    body: unknown,
  ): Promise<Acknowledgement> {
    return await this.mutate({
      path,
      method,
      body,
      schema: acknowledgementSchema,
    })
  }

  async mutate<T>(input: {
    path: string
    method: 'POST' | 'PUT' | 'DELETE'
    body: unknown
    key?: string
    schema: z.ZodType<T>
    signal?: AbortSignal
  }): Promise<T> {
    const packet = JSON.stringify(input.body)
    const fingerprint = `${input.method}:${input.path}:${packet}`
    const retryKey = input.key ?? this.pending.get(fingerprint)
    if (retryKey === undefined && this.pending.size >= 8) {
      throw new APIError(503, 'UNRESOLVED_MUTATIONS')
    }
    const requestKey = retryKey ?? crypto.randomUUID()
    // Explicit keys are owned by the caller (for example the autosave packet).
    // Retain only keys generated here for retries of manual mutations.
    if (input.key === undefined) {
      this.pending.set(fingerprint, requestKey)
    }
    let response = await this.send(input.path, {
      method: input.method,
      packet,
      key: requestKey,
      signal: input.signal,
    })
    if (response.status === 403 && (await csrfFailure(response))) {
      await this.refreshCsrf(input.signal)
      response = await this.send(input.path, {
        method: input.method,
        packet,
        key: requestKey,
        signal: input.signal,
      })
    }
    try {
      const result = await read(response, input.schema)
      this.releaseGeneratedKey(fingerprint, input.key)
      return result
    }
    catch (error) {
      if (definitiveFailure(error)) {
        this.releaseGeneratedKey(fingerprint, input.key)
      }
      throw error
    }
  }

  async verifyOwner(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    if (this.ownerSub !== undefined) {
      await this.currentSession(signal)
    }
    signal?.throwIfAborted()
  }

  private async currentSession(signal?: AbortSignal): Promise<z.infer<typeof sessionSchema>> {
    const session = await get('/api/admin/session', sessionSchema, signal)
    if (this.ownerSub !== undefined && session.ownerSub !== this.ownerSub) {
      throw new APIError(401, 'AUTH_INVALID')
    }
    return session
  }

  private async refreshCsrf(signal?: AbortSignal): Promise<void> {
    this.csrfToken = (await this.currentSession(signal)).csrfToken
  }

  private releaseGeneratedKey(fingerprint: string, key: string | undefined): void {
    if (key === undefined) {
      this.pending.delete(fingerprint)
    }
  }

  private async send(
    path: string,
    input: {
      method: string
      packet: string
      key: string
      signal?: AbortSignal
    },
  ): Promise<Response> {
    try {
      input.signal?.throwIfAborted()
      return await fetch(path, {
        method: input.method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.csrfToken,
          'Idempotency-Key': input.key,
        },
        body: input.packet,
        signal: input.signal,
      })
    }
    catch {
      throw new APIError(0, 'CONNECTION_FAILED')
    }
  }
}
async function csrfFailure(response: Response): Promise<boolean> {
  const problem: unknown = await response
    .clone()
    .json()
    .catch(() => null)
  return (
    problem !== null
    && typeof problem === 'object'
    && 'code' in problem
    && problem.code === 'CSRF_INVALID'
  )
}

function definitiveFailure(error: unknown): boolean {
  return (
    error instanceof APIError
    && (error.code === 'MAINTENANCE'
      || (error.status >= 400 && error.status < 500 && error.status !== 429))
  )
}
