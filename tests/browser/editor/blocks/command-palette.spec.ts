import { expect, test } from '~/tests/support/browser/test'

test('slash commands keep keyboard selection visible and insert the selected native block', async ({
  page,
}, info) => {
  await page.goto('/__fixture/login')
  await page.getByRole('button', { name: 'New post', exact: true }).click()
  const body = page.getByLabel('Document body', { exact: true })
  await body.press('/')
  const palette = page.getByRole('listbox', { name: 'Insert block', exact: true })
  const options = palette.getByRole('option')
  const selected = palette.getByRole('option', { selected: true })
  await expect(palette).toBeVisible()
  await expect(selected).toHaveCount(1)
  await expect(body).toBeFocused()
  await expect(body).toHaveAttribute('aria-controls', 'bn-suggestion-menu')
  await expect(body).toHaveAttribute('aria-activedescendant', await selected.getAttribute('id') ?? '')
  await page.screenshot({ path: info.outputPath('slash-palette-desktop.png'), fullPage: false })

  await body.press('PageDown')
  await expect(options.last()).toHaveAttribute('aria-selected', 'true')
  await expect.poll(async () => await selected.evaluate((element) => {
    const menu = element.closest('[role="listbox"]')
    if (menu === null) {
      return false
    }
    const box = element.getBoundingClientRect()
    const menuBox = menu.getBoundingClientRect()
    return box.top >= menuBox.top && box.bottom <= menuBox.bottom
  })).toBe(true)
  await expect(body).toBeFocused()

  await body.press('PageUp')
  await expect(options.first()).toHaveAttribute('aria-selected', 'true')
  await body.press('ArrowDown')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await body.press('Enter')
  await expect(palette).toHaveCount(0)
  await expect(body.locator('.bn-block-content[data-content-type="heading"][data-level="2"]'))
    .toBeVisible()
  await body.pressSequentially('Keyboard selected heading')
  await expect(body).toContainText('Keyboard selected heading')

  await page.setViewportSize({ width: 320, height: 740 })
  await body.press('Enter')
  await body.press('/')
  await expect(palette).toBeVisible()
  expect(await palette.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return box.left >= 0 && box.right <= window.innerWidth
  })).toBe(true)
  await page.screenshot({ path: info.outputPath('slash-palette-mobile.png'), fullPage: false })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(palette).toHaveCSS('animation-name', 'none')
  await body.press('Escape')
  await expect(palette).toHaveCount(0)
  await expect(body).toBeFocused()
})

test('Chinese slash commands show readable rich content and preserve English search aliases', async ({
  page,
}, info) => {
  await page.goto('/__fixture/login')
  await page.getByRole('combobox', { name: 'Language', exact: true }).click()
  await page.getByRole('option', { name: '简体中文', exact: true }).click()
  await expect(page.getByRole('option')).toHaveCount(0)
  await page.getByRole('button', { name: '新建文章', exact: true }).click()
  await page.setViewportSize({ width: 320, height: 740 })
  const chineseBody = page.getByLabel('正文', { exact: true })
  await chineseBody.press('/')
  const chinesePalette = page.getByRole('listbox', { name: '插入正文块', exact: true })
  await expect(chinesePalette.locator('.editor-option-title')).toContainText([
    '提示框',
    '脚注',
    '数学公式',
    '流程图',
    '目录',
    '链接卡片',
    'YouTube 视频',
  ])
  await expect(chinesePalette.locator('.editor-suggestions-label').last()).toHaveText('扩展内容')
  await chineseBody.pressSequentially('callout')
  const callout = chinesePalette.getByRole('option', { selected: true })
  await expect(chinesePalette.getByRole('option')).toHaveCount(1)
  await expect(callout.locator('.editor-option-title')).toHaveText('提示框')
  await expect(callout.locator('.editor-option-description')).toHaveText('突出显示补充说明、提示或警告')
  await expect(callout.locator('.editor-option-icon .lucide-info')).toBeVisible()
  await page.screenshot({ path: info.outputPath('slash-palette-chinese.png'), fullPage: false })
  await expect(chinesePalette).toBeVisible()
  await expect(chineseBody).toBeFocused()
  await chineseBody.press('Enter')
  await expect(chinesePalette).toHaveCount(0)
  await expect(chineseBody.locator('.bn-block-content[data-content-type="callout"]')).toBeVisible()
})
