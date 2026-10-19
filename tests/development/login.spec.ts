import { readFile, writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { openDocumentSchema } from '@/contracts/documents'
import { saved } from '~/tests/support/browser/document'

test('development login keeps authentication and CSRF guards', async ({ page, request }) => {
  expect((await request.get('/api/admin/session')).status()).toBe(401)
  expect((await request.get('/api/admin/session', {
    headers: { 'cf-access-jwt-assertion': 'forged', 'cookie': 'blog_dev_access=forged' },
  })).status()).toBe(401)
  expect((await request.get('/__fixture/login', {
    headers: { 'sec-fetch-site': 'cross-site' },
  })).status()).toBe(403)
  expect((await request.post('/__fixture/login')).status()).toBe(403)
  expect((await request.get('/__fixture/login', { headers: { host: 'example.com' } })).status()).toBe(403)
  await page.goto('/__fixture/login')
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
  expect((await page.request.get('/api/admin/session')).status()).toBe(200)
  expect((await page.request.post('/api/admin/documents', { data: {} })).status()).toBe(403)
  const cookies = await page.context().cookies()
  expect(cookies.find(cookie => cookie.name === 'blog_dev_access'))
    .toMatchObject({ httpOnly: true, sameSite: 'Strict' })
  await page.goto('/__fixture/logout')
  expect((await page.request.get('/api/admin/session')).status()).toBe(401)
})

test('development editor saves and receives CSS HMR without navigation', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    // BlockNote's existing attributionTooltip prop warning is unrelated to development login/HMR.
    if (message.type() === 'error' && !message.text().includes('attributionTooltip')) {
      errors.push(message.text())
    }
  })
  await page.goto('/__fixture/login')
  await expect(page.getByRole('button', { name: 'Refresh list', exact: true })).toBeEnabled({ timeout: 20000 })
  const created = page.waitForResponse(response =>
    response.url().endsWith('/api/admin/documents') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'New post', exact: true }).click()
  expect((await created).status()).toBe(201)
  await expect(page.getByLabel('Document body', { exact: true })).toBeVisible({ timeout: 20000 })
  const title = `Development HMR ${crypto.randomUUID()}`
  await page.getByLabel('Title', { exact: true }).fill(title)
  await page.getByLabel('Document body', { exact: true }).fill('Saved through the development Worker')
  await saved(page)
  const pathname = new URL(page.url()).pathname
  const response = await page.request.get(`/api${pathname}`)
  expect(response.status()).toBe(200)
  expect(openDocumentSchema.parse(await response.json()).document.meta.title).toBe(title)
  await page.evaluate(() => document.documentElement.dataset.devHmrSentinel = 'still-here')
  const stylesheet = 'src/app/styles.css'
  const original = await readFile(stylesheet, 'utf8')
  try {
    await writeFile(stylesheet, `${original}\n:root { --blog-dev-hmr-proof: verified; }\n`)
    await expect.poll(async () => await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--blog-dev-hmr-proof').trim()))
      .toBe('verified')
    expect(await page.evaluate(() => document.documentElement.dataset.devHmrSentinel)).toBe('still-here')
    expect(new URL(page.url()).pathname).toBe(pathname)
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title)
  }
  finally {
    await writeFile(stylesheet, original)
  }
  await expect.poll(async () => await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--blog-dev-hmr-proof').trim()))
    .toBe('')
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title)
  expect(errors).toEqual([])
  await page.screenshot({ path: info.outputPath('development-editor.png') })
})

test('React component HMR updates the page and preserves the login', async ({ page }, info) => {
  await page.goto('/__fixture/login')
  await expect(page.getByRole('button', { name: 'Refresh list', exact: true })).toBeEnabled()
  await page.evaluate(() => document.documentElement.dataset.devHmrSentinel = 'still-here')
  const component = 'src/features/documents/document-list.tsx'
  const original = await readFile(component, 'utf8')
  const updated = original.replace(
    '<h1 className={layout4Class}>{copy.title}</h1>',
    '<h1 className={layout4Class}>{copy.title} HMR verified</h1>',
  )
  expect(updated).not.toBe(original)
  try {
    await writeFile(component, updated)
    await expect(page.getByRole('heading', { name: 'Documents HMR verified', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.dataset.devHmrSentinel)).toBe('still-here')
    expect((await page.request.get('/api/admin/session')).status()).toBe(200)
    await page.screenshot({ path: info.outputPath('react-hmr.png') })
  }
  finally {
    await writeFile(component, original)
  }
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
})
