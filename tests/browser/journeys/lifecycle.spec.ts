import type { TestInfo } from '@playwright/test'
import type { JourneyContext } from '~/tests/support/browser/journey'
import { emptyDocument } from '@/content/document'
import { catalogListSchema } from '@/contracts/catalog'
import { saved } from '~/tests/support/browser/document'
import {
  documentAction,
  expect,
  layoutCheckpoint,
  navigation,
  opened,
  previewCheckpoint,
  semanticCheckpoint,
  test,
} from '~/tests/support/browser/journey'

const title = 'long task: catalog, article, public navigation, updates, trash and standalone page'

test(title, async ({ page, context, journey }, info) => {
  test.setTimeout(180000)
  const state = prepare({ page, context, journey }, info)
  await test.step(
    'create both catalogs through their managers',
    async () => await createCatalogs(state),
  )
  await test.step(
    'create and edit an article with catalog associations',
    async () => await createArticle(state),
  )
  await test.step(
    'publish and navigate the public article, catalogs and search',
    async () => await readPublication(state),
  )
  await test.step(
    'save private changes, reopen preview, then update publication',
    async () => await updateArticle(state),
  )
  await test.step(
    'unpublish, cancel deletion, delete and restore from trash',
    async () => await restoreDeletedArticle(state),
  )
  await test.step(
    'publish a standalone page and verify final article reopening',
    async () => await publishPage(state),
  )
})

function prepare({ page, context, journey }: JourneyContext, info: TestInfo) {
  const id = ''
  const expected = emptyDocument()
  const editorURL = ''

  return { page, context, journey, info, id, expected, editorURL }
}

type State = Awaited<ReturnType<typeof prepare>>

async function createCatalogs(state: State): Promise<void> {
  const { page, journey, info } = state

  await page.goto('/__fixture/login')
  for (const [section, name, slug] of [
    [
      'Tags',
      'Journey tag',
      'journey-tag',
    ],
    [
      'Series',
      'Journey series',
      'journey-series',
    ],
  ] as const) {
    await navigation(page, section)
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
    await page.getByLabel('Name', { exact: true }).fill(name)
    await page.getByLabel('Slug', { exact: true }).fill(slug)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.locator('.catalog-list')).toContainText(name)
    await layoutCheckpoint(page, info, journey, `catalog-${slug}`)
  }
}

async function createArticle(state: State): Promise<void> {
  let { page, journey, info, id, expected, editorURL } = state

  await navigation(page, 'Documents')
  await page.getByRole('button', { name: 'New post', exact: true }).click()
  await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
  editorURL = page.url()
  id = new URL(editorURL).pathname.split('/').at(-1) ?? ''
  expected = structuredClone((await opened(page, id)).document)
  expected.meta.title = 'Journey article'
  expected.meta.slug = 'journey-article'
  await page.getByLabel('Title', { exact: true }).fill(expected.meta.title)
  await page.getByLabel('Slug', { exact: true }).fill(expected.meta.slug)
  await page.getByLabel('Document body', { exact: true }).fill('Journey published body 中文')
  const first = expected.blocks[0]
  if (first === undefined) {
    throw new Error('Missing initial block')
  }
  first.content = [
    { type: 'text', text: 'Journey published body 中文', styles: {} },
  ]
  await page.getByRole('button', { name: 'Tags and series', exact: true }).click()
  for (const [kind, label, name] of [
    [
      'tag',
      'Tags',
      'Journey tag',
    ],
    [
      'series',
      'Series',
      'Journey series',
    ],
  ] as const) {
    await page.getByRole('combobox', { name: label, exact: true }).click()
    await page.getByRole('option', { name, exact: true }).click()
    await page.keyboard.press('Escape')
    const catalog = catalogListSchema.parse(await (await page.request.get(`/api/admin/catalog/${kind}`)).json())
    const item = catalog.items.find(entry => entry.name === name)
    expect(item).toBeDefined()
    if (item === undefined) {
      throw new Error('Missing created catalog')
    }
    if (kind === 'tag') {
      expected.meta.tags = [
        { id: item.id, slug: item.slug, label: name },
      ]
    }
    else {
      expected.meta.series = [
        { id: item.id, slug: item.slug, title: name, position: 1000 },
      ]
    }
  }
  await semanticCheckpoint(page, info, journey, { name: 'article-saved', id, expected })
  await previewCheckpoint(page, 'Journey published body 中文')
  expect((await page.request.get('/posts/journey-article')).status()).toBe(404)

  Object.assign(state, { id, expected, editorURL })
}

async function readPublication(state: State): Promise<void> {
  const { page, context, journey, info, id } = state

  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
  const live = await opened(page, id)
  expect(live.liveRevisionId).toBe(live.headRevisionId)
  const reader = await context.newPage()
  await reader.goto('/posts/journey-article')
  await expect(reader.locator('.reader')).toContainText('Journey published body 中文')
  for (const name of ['Journey tag', 'Journey series']) {
    await reader.getByRole('link', { name, exact: true }).click()
    await reader.getByRole('link', { name: 'Journey article' }).click()
    await expect(reader.locator('.reader')).toContainText('Journey published body 中文')
  }
  await reader.getByRole('link', { name: 'Search', exact: true }).click()
  await reader.getByRole('searchbox').fill('Journey')
  await reader.getByRole('button', { name: 'Search', exact: true }).click()
  await reader.getByRole('link', { name: 'Journey article' }).click()
  await layoutCheckpoint(reader, info, journey, 'public-article-after-navigation')
  await reader.close()

  Object.assign(state, { id })
}

async function updateArticle(state: State): Promise<void> {
  const { page, journey, info, id, expected } = state

  const before = await opened(page, id)
  await page.getByLabel('Document body', { exact: true }).fill('Journey updated body 中文')
  const first = expected.blocks[0]
  if (first !== undefined) {
    first.content = [
      { type: 'text', text: 'Journey updated body 中文', styles: {} },
    ]
  }
  await semanticCheckpoint(page, info, journey, { name: 'private-update', id, expected })
  expect((await opened(page, id)).liveRevisionId).toBe(before.liveRevisionId)
  const publicBefore = await (await page.request.get('/posts/journey-article')).text()
  expect(publicBefore).toContain('Journey published body 中文')
  expect(publicBefore).not.toContain('Journey updated body 中文')
  await previewCheckpoint(page, 'Journey updated body 中文')
  await page.getByRole('button', { name: 'Update publication', exact: true }).click()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
  expect(await (await page.request.get('/posts/journey-article')).text()).toContain('Journey updated body 中文')

  Object.assign(state, { id, expected })
}

async function restoreDeletedArticle(state: State): Promise<void> {
  const { page, journey, info, id, expected } = state

  await documentAction(page, 'Unpublish')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect.poll(async () => (await opened(page, id)).liveRevisionId).toBeNull()
  expect((await page.request.get('/posts/journey-article')).status()).toBe(404)
  await documentAction(page, 'Delete document')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'More document actions', exact: true })).toBeFocused()
  await documentAction(page, 'Delete document')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Publication state', exact: true }).click()
  await page.getByRole('option', { name: 'Trash', exact: true }).click()
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Document restored as a draft')
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await page.getByRole('link', { name: 'Journey article', exact: true }).click()
  await semanticCheckpoint(page, info, journey, { name: 'restored-article', id, expected })
  expect((await opened(page, id)).liveRevisionId).toBeNull()
  await previewCheckpoint(page, 'Journey updated body 中文')

  Object.assign(state, { id, expected })
}

async function publishPage(state: State): Promise<void> {
  const { page, journey, info, id, expected, editorURL } = state

  await navigation(page, 'Documents')
  await page.getByRole('button', { name: 'New page', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('Journey standalone page')
  await page.getByLabel('Slug', { exact: true }).fill('journey-page')
  await page.getByLabel('Document body', { exact: true }).fill('Standalone page body')
  await saved(page)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('link', { name: 'View live document', exact: true }))
    .toHaveAttribute('href', '/pages/journey-page')
  expect(await (await page.request.get('/pages/journey-page')).text()).toContain('Standalone page body')
  await navigation(page, 'Documents')
  await page.getByRole('link', { name: 'Journey article', exact: true }).click()
  await expect(page).toHaveURL(editorURL)
  await semanticCheckpoint(page, info, journey, { name: 'final-reopened-article', id, expected })

  Object.assign(state, { id, expected, editorURL })
}
