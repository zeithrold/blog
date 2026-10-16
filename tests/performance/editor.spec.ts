import { expect, test } from '~/tests/support/browser/test'
import { openFixture, percentile, typing } from './helpers'
import {
  captures,
  samples as measuredSamples,
  previewSamples,
  verifySaved,
} from './measurements'

for (const row of [
  { count: 100, bytes: 64000, cpu: 1, ready: 1000, p95: 50, p99: 100, previewP95: 500 },
  { count: 500, bytes: 190000, cpu: 1, ready: 1000, p95: 50, p99: 100, previewP95: 500 },
  { count: 2000, bytes: 522000, cpu: 1, ready: 2000, p95: 80, p99: 150, previewP95: 2000 },
  { count: 500, bytes: 190000, cpu: 4, ready: 2500, p95: 100, p99: 200, previewP95: 750 },
]) {
  test(`${row.count} native blocks / ${row.bytes} bytes / ${row.cpu}x CPU`, async ({
    page,
    context,
  }, info) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: row.cpu })
    const input = await openFixture(page, row.count, row.bytes)
    const samples = await typing(page)
    const locations = await verifySaved(page, input.documentId)
    const navigation = await measuredSamples(page, 'navigation')
    const preview = await previewSamples(page)
    const snapshots = await captures(page)
    const report = {
      ...input,
      blockCount: row.count,
      cpuRate: row.cpu,
      method: 'admin-open-to-editor-ready plus two-rAF input proxy',
      previewMethod: 'open the draft preview dialog after each edit; reader module warmed',
      samples,
      locations,
      navigation,
      preview,
      snapshots,
      previewP95: percentile(preview, 0.95),
      navigationP95: percentile(navigation, 0.95),
      snapshotMax: Math.max(...snapshots),
      p95: percentile(samples, 0.95),
      p99: percentile(samples, 0.99),
      errors,
    }
    await info.attach('performance.json', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    })
    await page.screenshot({ path: info.outputPath('editor.png') })
    expect(errors).toEqual([])
    expect(samples.length).toBeGreaterThanOrEqual(240)
    expect(navigation.length).toBeGreaterThanOrEqual(48)
    expect(snapshots.length).toBeGreaterThan(0)
    expect(report.readyMs).toBeLessThanOrEqual(row.ready)
    expect(report.p95).toBeLessThanOrEqual(row.p95)
    expect(report.p99).toBeLessThanOrEqual(row.p99)
    expect(report.navigationP95).toBeLessThanOrEqual(row.p95)
    expect(report.snapshotMax).toBeLessThanOrEqual(50)
    expect(report.previewP95).toBeLessThanOrEqual(row.previewP95)
  })
}
