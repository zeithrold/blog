import type { Page } from '@playwright/test'
import type { ComponentLocale, ComponentMode } from '../src/contract'
import type { ApiCall, ApiHandler, ApiReply, ApiService } from './http-fixtures'
import type { Acknowledgement, OpenDocument } from '@/contracts/documents'
import { z } from 'zod'
import { validateDocument } from '@/content/document'
import { publicationPath } from '@/content/publication-path'
import { saveSchema } from '@/contracts/documents'
import {
  publishSchema,
  scheduleCancelSchema,
  scheduleInputSchema,
  scheduleItemSchema,
  scheduleTimeSchema,
  unpublishSchema,
} from '@/contracts/publication'
import { timeChoices } from '@/server/publication/schedule-time'
import { COMPONENT_TEST_FIXTURES } from '../src/fixtures'
import {
  EDITOR_WORKSPACE_DOCUMENT_ID,
  editorWorkspaceDocument,
} from './editor-workspace-fixtures'
import { failure, serveApi } from './http-fixtures'
import { mountSurface } from './mount'

/**
 * Explicit HTTP boundary for the remaining publication and schedule cases.
 *
 * The production editor entry, draft coordinator, publication controllers and
 * schedule views run unchanged; only their HTTP replies are declared here. A
 * handler may advance the declared version and head revision so a retried
 * write carries the version it was given, but nothing here is persisted:
 * D1/R2 storage, the real due-publication job and public SSR stay with the
 * focused E2E cases and `tests/integration/full-services.integration.ts`,
 * `transactions.integration.ts` and `history-mutations.integration.ts`.
 */
export type PublicationScheduleItem = z.infer<typeof scheduleItemSchema>

/** The document and schedule rows the declared route currently answers with. */
export type PublicationState = {
  open: OpenDocument
  items: PublicationScheduleItem[]
}

/** Reads only the version a declared request guarded itself with. */
const versionedRequest = z.object({ expectedVersion: z.number().int().nonnegative() })

/** The acknowledgement fields a declared write answers with. */
export function acknowledgementOf(open: OpenDocument): Acknowledgement {
  return {
    documentId: open.documentId,
    version: open.version,
    headRevisionId: open.headRevisionId,
    liveRevisionId: open.liveRevisionId,
    liveGeneration: open.liveGeneration,
  }
}

/** A saved document that another tab replaced while this editor stayed open. */
export function savedAhead(open: OpenDocument, title: string): OpenDocument {
  const next = structuredClone(open)
  next.version += 1
  next.headRevisionId = crypto.randomUUID()
  next.document.meta.title = title
  return next
}

/** The schedule row a document answers with; overrides keep it schema-valid. */
export function publicationSchedule(
  open: OpenDocument,
  overrides: Partial<PublicationScheduleItem> = {},
): PublicationScheduleItem {
  const runAt = Date.now() + 86400000
  return scheduleItemSchema.parse({
    id: crypto.randomUUID(),
    revisionId: open.headRevisionId,
    state: 'pending',
    runAt,
    localTime: new Date(runAt).toISOString().slice(0, 16),
    timezone: 'UTC',
    utcOffset: 0,
    attempts: 0,
    nextAttemptAt: runAt,
    errorCode: null,
    createdAt: Date.now(),
    ...overrides,
  })
}

export function publicationState(
  open: OpenDocument,
  items: PublicationScheduleItem[] = [],
): PublicationState {
  return { open, items }
}

/** The saved revision a successful revision write answers with. */
export function acceptSave(state: PublicationState, call: ApiCall): ApiReply {
  const body = saveSchema.parse(call.json)
  if (
    body.expectedVersion !== state.open.version
    || body.baseRevisionId !== state.open.headRevisionId
  ) {
    return failure(409, 'EDIT_CONFLICT')
  }
  state.open = {
    ...state.open,
    version: body.expectedVersion + 1,
    headRevisionId: crypto.randomUUID(),
    document: validateDocument(body.document),
  }
  return { body: acknowledgementOf(state.open) }
}

/** The version-guarded publish or unpublish acknowledgement. */
export function acceptPublication(
  state: PublicationState,
  call: ApiCall,
  unpublish: boolean,
): ApiReply {
  const body = unpublish ? unpublishSchema.parse(call.json) : publishSchema.parse(call.json)
  const revisionId = 'revisionId' in body ? body.revisionId : undefined
  if (
    body.expectedVersion !== state.open.version
    || body.expectedLiveGeneration !== state.open.liveGeneration
    || (!unpublish && revisionId !== state.open.headRevisionId)
  ) {
    return failure(409, 'EDIT_CONFLICT')
  }
  state.open = {
    ...state.open,
    version: body.expectedVersion + 1,
    liveGeneration: body.expectedLiveGeneration + 1,
    liveRevisionId: unpublish ? null : state.open.headRevisionId,
    livePath: unpublish
      ? null
      : publicationPath(state.open.kind, state.open.document.meta.slug),
  }
  return { body: acknowledgementOf(state.open) }
}

/** A stored plan as the schedule repository would list and acknowledge it. */
export function acceptSchedule(state: PublicationState, call: ApiCall): ApiReply {
  const body = scheduleInputSchema.parse(call.json)
  if (body.expectedVersion !== state.open.version) {
    return failure(409, 'EDIT_CONFLICT')
  }
  const item = publicationSchedule(state.open, {
    revisionId: body.revisionId,
    runAt: body.runAt,
    localTime: body.localTime,
    timezone: body.timezone,
    utcOffset: body.utcOffset,
  })
  state.items = [
    item,
    ...state.items,
  ]
  state.open = { ...state.open, version: body.expectedVersion + 1 }
  return {
    body: {
      ...acknowledgementOf(state.open),
      scheduleId: item.id,
      state: 'pending',
    },
  }
}

/** Cancelling changes the plan and the document version, never the head. */
export function acceptCancel(state: PublicationState, call: ApiCall): ApiReply {
  const body = scheduleCancelSchema.parse(call.json)
  if (body.expectedVersion !== state.open.version) {
    return failure(409, 'EDIT_CONFLICT')
  }
  state.items = state.items.map(item =>
    item.id === body.scheduleId ? { ...item, state: 'cancelled' as const } : item)
  state.open = { ...state.open, version: body.expectedVersion + 1 }
  return {
    body: {
      ...acknowledgementOf(state.open),
      scheduleId: body.scheduleId,
      state: 'cancelled',
    },
  }
}

/** The real timezone rule builds the explicit reply; the route stays declared. */
export function scheduleTimeReply(call: ApiCall): ApiReply {
  try {
    const localTime = call.query.get('localTime') ?? ''
    const timezone = call.query.get('timezone') ?? 'UTC'
    return {
      body: scheduleTimeSchema.parse({
        choices: timeChoices(localTime, timezone),
      }),
    }
  }
  catch {
    return failure(400, 'TIMEZONE_INVALID')
  }
}

/** Every read and write the mounted workspace performs, with case overrides. */
export function publicationHandlers(
  state: PublicationState,
  writes: Readonly<Record<string, ApiHandler>> = {},
): Record<string, ApiHandler> {
  return {
    'GET /api/admin/session': () => ({
      body: {
        csrfToken: COMPONENT_TEST_FIXTURES.csrfToken,
        ownerSub: COMPONENT_TEST_FIXTURES.owner,
      },
    }),
    'GET /api/admin/documents/:id': () => ({ body: state.open }),
    'GET /api/admin/documents/:id/schedule': () => ({ body: { items: state.items } }),
    'GET /api/admin/schedule-time': scheduleTimeReply,
    'GET /api/admin/catalog/tag': () => ({ body: { items: [] } }),
    'GET /api/admin/catalog/series': () => ({ body: { items: [] } }),
    'PUT /api/admin/documents/:id/revisions': call => acceptSave(state, call),
    'POST /api/admin/documents/:id/publish': call => acceptPublication(state, call, false),
    'POST /api/admin/documents/:id/unpublish': call => acceptPublication(state, call, true),
    'POST /api/admin/documents/:id/schedule': call => acceptSchedule(state, call),
    'DELETE /api/admin/documents/:id/schedule': call => acceptCancel(state, call),
    ...writes,
  }
}

export type PublicationMount = {
  state: PublicationState
  width?: number
  height?: number
  locale?: ComponentLocale
  mode?: ComponentMode
  writes?: Readonly<Record<string, ApiHandler>>
}

/** Mounts the real editor entry on its document route with declared replies. */
export async function mountPublicationWorkspace(
  page: Page,
  options: PublicationMount,
): Promise<ApiService> {
  const api = await serveApi(page, publicationHandlers(options.state, options.writes))
  await page.setViewportSize({ width: options.width ?? 1440, height: options.height ?? 900 })
  await mountSurface(page, {
    surface: 'editor-workspace',
    locale: options.locale ?? 'en',
    mode: options.mode ?? 'light',
    route: `/admin/documents/${EDITOR_WORKSPACE_DOCUMENT_ID}`,
  })
  return api
}

/** The version a case's declared write guarded itself with. */
export function expectedVersionOf(call: ApiCall): number {
  return versionedRequest.parse(call.json).expectedVersion
}

/** The title the client put in a revision write, from its validated body. */
export function savedTitleOf(call: ApiCall): string {
  return validateDocument(saveSchema.parse(call.json).document).meta.title
}

/** A saved draft for the cases whose fixture is not the rejection itself. */
export function publicationDocument(title: string): OpenDocument {
  return editorWorkspaceDocument(title, (document) => {
    document.meta.slug = `publication-remaining-${crypto.randomUUID()}`
  })
}
