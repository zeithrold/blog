import type { TestInfo } from '@playwright/test'
import type { JourneyContext } from '~/tests/support/browser/journey'
import { emptyDocument } from '@/content/document'
import { operationsSchema } from '@/contracts/operations'
import { scheduleListSchema } from '@/contracts/publication'
import { chooseTimezone, publicationTime, verifiedTime } from '~/tests/browser/publication/schedule-helpers'
import { saved, writeDocument } from '~/tests/support/browser/document'
import {
  expect,
  layoutCheckpoint,
  navigation,
  opened,
  previewCheckpoint,
  semanticCheckpoint,
  test,
} from '~/tests/support/browser/journey'
import { settingsTab } from '~/tests/support/browser/settings'
import { inline, textBlock } from './content-fixture'

const title = 'long task: fix preflight, pin and cancel schedules, recover authentication and resume maintenance'

test(title, async ({ page, context, journey }, info) => {
  test.setTimeout(180000)
  expect((await page.request.post('/__fixture/scenario', { data: 'maintenance' })).status()).toBe(403)
  const state = await prepare({ page, context, journey }, info)
  expect((await page.request.post('/__fixture/scenario', { data: 'arbitrary SQL' })).status()).toBe(400)
  await test.step(
    'locate invalid content, repair it and recheck the publication summary',
    async () => await repairPreflight(state),
  )
  await test.step(
    'schedule, cancel, reschedule, then edit a newer draft without changing the pin',
    async () => await pinSchedules(state),
  )
  await test.step(
    'recover a failed authentication refresh without losing the completed publication',
    async () => await recoverAuthentication(state),
  )
  await test.step(
    'reject real writes in maintenance, then resume through the operations UI',
    async () => await resumeMaintenance(state),
  )
  await test.step(
    'reopen after maintenance and explicitly publish the newer draft',
    async () => await publishNewerDraft(state),
  )
})

async function prepare({ page, context, journey }: JourneyContext, info: TestInfo) {
  const expected = emptyDocument()
  expected.meta.title = 'Journey publication'
  expected.meta.slug = 'journey-publication'
  const paragraph = expected.blocks[0]
  if (paragraph === undefined) {
    throw new Error('Missing publication paragraph')
  }
  paragraph.content = inline('Journey pinned publication body')
  const diagram = textBlock('mermaid', 'unsupported diagram', { description: 'Journey publication diagram' })
  expected.blocks.push(diagram)
  const ack = await writeDocument(page, expected)
  const path = `/api/admin/documents/${ack.documentId}`
  const pinned = ''

  return { page, context, journey, info, expected, paragraph, diagram, ack, path, pinned }
}

type State = Awaited<ReturnType<typeof prepare>>

async function repairPreflight(state: State): Promise<void> {
  const { page, journey, info, expected, diagram, ack } = state

  await settingsTab(page, 'Publication')
  const issues = page.locator('.publication-issues')
  await expect(issues).toContainText('Fix empty or unsupported diagram content before publishing.')
  await issues.getByRole('button').click()
  await page.locator('[data-content-type="mermaid"]')
    .getByRole('button', { name: 'Edit diagram', exact: true })
    .click()
  const source = page.locator('[data-content-type="mermaid"] code[aria-label]')
  await expect(source).toBeVisible()
  await source.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText('graph TD')
  await page.keyboard.press('Enter')
  await page.keyboard.insertText('A-->B')
  await page.locator('[data-content-type="mermaid"]').getByRole('button', { name: 'Done', exact: true }).click()
  diagram.content = inline('graph TD\nA-->B')
  await expect(issues).toHaveCount(0)
  await semanticCheckpoint(page, info, journey, { name: 'preflight-repaired', id: ack.documentId, expected })
  await previewCheckpoint(page, 'Journey pinned publication body')
}

async function pinSchedules(state: State): Promise<void> {
  let { page, journey, info, expected, paragraph, ack, path, pinned } = state

  await settingsTab(page, 'Publication')
  await page.getByRole('button', { name: 'Scheduled publication', exact: true }).click()
  await publicationTime(page, new Date(Date.now() + 86400000).toISOString().slice(0, 16))
  await chooseTimezone(page, 'UTC')
  await page.getByRole('button', { name: 'Check timezone and DST', exact: true }).click()
  await verifiedTime(page)
  pinned = (await opened(page, ack.documentId)).headRevisionId
  await page.getByRole('button', { name: 'Schedule saved draft', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cancel schedule', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel schedule', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cancel schedule', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Schedule saved draft', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cancel schedule', exact: true })).toBeVisible()
  await page.getByLabel('Document body', { exact: true })
    .locator('[data-content-type="paragraph"] .bn-inline-content')
    .fill('Journey newer private body')
  paragraph.content = inline('Journey newer private body')
  await semanticCheckpoint(page, info, journey, { name: 'scheduled-newer-draft', id: ack.documentId, expected })
  const jobs = scheduleListSchema.parse(await (await page.request.get(`${path}/schedule`)).json())
  expect(jobs.items.filter(job => job.state === 'pending').map(job => job.revisionId)).toEqual([pinned])
  expect(jobs.items.filter(job => job.state === 'cancelled')).toHaveLength(1)
  const run = await page.request.post('/__fixture/scenario', { data: 'run-due' })
  expect(run.status()).toBe(200)
  expect(await run.json()).toEqual({ completed: 1 })
  expect(await (await page.request.post('/__fixture/scenario', { data: 'run-due' })).json()).toEqual({ completed: 0 })
  const after = await opened(page, ack.documentId)
  expect(after.liveRevisionId).toBe(pinned)
  expect(after.headRevisionId).not.toBe(pinned)
  const publicHTML = await (await page.request.get('/posts/journey-publication')).text()
  expect(publicHTML).toContain('Journey pinned publication body')
  expect(publicHTML).not.toContain('Journey newer private body')

  Object.assign(state, { pinned })
}

async function recoverAuthentication(state: State): Promise<void> {
  const { page, journey, info } = state

  await navigation(page, 'Operations')
  await expect(page.getByText('Workspace is writable', { exact: true })).toBeVisible()
  const failure = { path: '/api/admin/operations', method: 'GET', status: 401, hits: 0, active: true }
  journey.failures.push(failure)
  await page.route('**/api/admin/operations', async (route) => {
    await route.fulfill({ status: 401, json: { code: 'AUTH_REQUIRED' } })
  }, { times: 1 })
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await layoutCheckpoint(page, info, journey, 'operations-auth-failure')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  failure.active = false
  const operations = operationsSchema.parse(await (await page.request.get('/api/admin/operations')).json())
  expect(operations.searchableDocuments).toBe(1)
  expect(operations.pendingSchedules).toBe(0)
  expect(operations.failedSchedules).toBe(0)
}

async function resumeMaintenance(state: State): Promise<void> {
  const { page, journey, info, expected, ack, path } = state

  expect((await page.request.post('/__fixture/scenario', { data: 'maintenance' })).status()).toBe(204)
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click()
  await expect(page.getByText('Paused for maintenance', { exact: true })).toBeVisible()
  await navigation(page, 'Documents')
  await page.getByRole('link', { name: 'Journey publication', exact: true }).click()
  const failure = { path: `${path}/revisions`, method: 'PUT', status: 503, hits: 0, active: true }
  journey.failures.push(failure)
  await page.getByLabel('Title', { exact: true }).fill('Journey rejected maintenance edit')
  await expect(page.locator('.editor-notice[data-tone="error"]')).toBeVisible({ timeout: 15000 })
  expect((await opened(page, ack.documentId)).document).toEqual(expected)
  // Resume in a second tab, retaining the failed draft and original editor instance.
  const operations = await page.context().newPage()
  await operations.goto('/admin/operations')
  const resume = operations.getByRole('button', { name: 'Resume restored database writes', exact: true })
  await resume.click()
  await operations.keyboard.press('Escape')
  await expect(resume).toBeFocused()
  await resume.click()
  await operations.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(operations.getByText('Workspace is writable', { exact: true })).toBeVisible()
  await layoutCheckpoint(operations, info, journey, 'operations-resumed')
  await operations.close()
  failure.active = false
  await page.getByLabel('Title', { exact: true }).fill('Journey publication after maintenance')
  expected.meta.title = 'Journey publication after maintenance'
  await semanticCheckpoint(page, info, journey, { name: 'maintenance-retried', id: ack.documentId, expected })
}

async function publishNewerDraft(state: State): Promise<void> {
  const { page, journey, info, expected, ack, pinned } = state

  await page.reload()
  await semanticCheckpoint(page, info, journey, { name: 'publication-reopened', id: ack.documentId, expected })
  await previewCheckpoint(page, 'Journey newer private body')
  await page.getByRole('button', { name: 'Update publication', exact: true }).click()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
  const final = await opened(page, ack.documentId)
  expect(final.liveRevisionId).toBe(final.headRevisionId)
  expect(final.liveRevisionId).not.toBe(pinned)
  const reader = await page.context().newPage()
  await reader.goto('/posts/journey-publication')
  await expect(reader.locator('.reader')).toContainText('Journey newer private body')
  await expect(reader.getByRole('heading', { name: 'Journey publication after maintenance', exact: true }))
    .toBeVisible()
  await layoutCheckpoint(reader, info, journey, 'publication-final-reader')
  await reader.close()
  await saved(page)

  Object.assign(state, { pinned })
}
