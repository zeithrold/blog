import { test } from '~/tests/support/browser/test'
import { verifyNativeSlashTable } from './table-overlay-interaction-helpers'

test('native slash table keeps unset widths through middle insertion and reload', async ({ page }) => {
  await verifyNativeSlashTable(page)
})
