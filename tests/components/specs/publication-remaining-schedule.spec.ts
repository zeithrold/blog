import { editorReady } from '../support/editor-workspace-ui'
import { openScheduleForm } from '../support/publication-remaining'
import {
  mountPublicationWorkspace,
  publicationDocument,
  publicationSchedule,
  publicationState,
} from '../support/publication-remaining-server'
import { expect, test } from '../support/test'

test('failed schedule explanations fit the Chinese mobile drawer', async ({ page }, info) => {
  const open = publicationDocument('Chinese failed plan')
  const failed = publicationSchedule(open, {
    state: 'failed',
    attempts: 1,
    errorCode: 'PUBLICATION_CONFLICT',
  })
  const state = publicationState(open, [failed])
  const api = await mountPublicationWorkspace(page, { state, width: 390, locale: 'zh' })
  try {
    await editorReady(page, 'zh')
    await openScheduleForm(page, 'zh')
    const error = page.locator('.schedule-error')
    await error.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('schedule-failed-390-zh.png') })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
