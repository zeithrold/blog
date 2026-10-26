import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * The header, drawer and dialog copy the chrome cases act on, in both locales.
 * A case switches the interface language at runtime and then reads these labels,
 * so the translated chrome is asserted rather than the harness's initial mount.
 */
export type ChromeLocale = 'en' | 'zh'

export type ChromeCopy = {
  readonly language: string
  readonly back: string
  readonly compactBack: string
  readonly publish: string
  readonly more: string
  readonly sync: string
  readonly close: string
  readonly remove: string
  readonly cancel: string
}

export const chromeCopy: Readonly<Record<ChromeLocale, ChromeCopy>> = {
  en: {
    language: 'English',
    back: 'All documents',
    compactBack: 'Back',
    publish: 'Publish',
    more: 'More document actions',
    sync: 'Sync draft now',
    close: 'Close',
    remove: 'Delete document',
    cancel: 'Cancel',
  },
  zh: {
    language: '简体中文',
    back: '所有文档',
    compactBack: '返回',
    publish: '发布',
    more: '更多文档操作',
    sync: '立即同步草稿',
    close: '关闭',
    remove: '删除文档',
    cancel: '取消',
  },
}

/** Switches the interface language from the shell Select an author uses. */
export async function chooseLanguage(page: Page, locale: ChromeLocale): Promise<void> {
  await page.getByRole('combobox', { name: /^(Language|语言)$/ }).click()
  await page.getByRole('option', { name: chromeCopy[locale].language, exact: true }).click()
  await expect(page.getByRole('option')).toHaveCount(0)
}

/** The sticky editor header every chrome geometry assertion measures against. */
export function editorChrome(page: Page): Locator {
  return page.locator('.workspace-header')
}

export type ElementBox = { readonly top: number, readonly bottom: number, readonly height: number }

export async function box(locator: Locator): Promise<ElementBox> {
  return await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return { top: bounds.top, bottom: bounds.bottom, height: bounds.height }
  })
}

export type ChromeGeometry = {
  /** The toolbar's distance below the header; it must not slide under it. */
  readonly toolbarGap: number
  /** The header's distance below the shell appbar the sticky offset follows. */
  readonly headerGap: number
  readonly overflow: boolean
}

/**
 * The sticky chrome as actually laid out: three real boxes and the document's
 * overflow, not the declared CSS. The appbar and toolbar are looked up by their
 * production class names because they are the boxes the offset is measured from.
 */
export async function chromeGeometry(page: Page): Promise<ChromeGeometry> {
  return await page.evaluate(() => {
    const appbar = document.querySelector('.ztd-application > .ztd-appbar')?.getBoundingClientRect()
    const header = document.querySelector('.workspace-header')?.getBoundingClientRect()
    const toolbar = document.querySelector('.editor-actions')?.getBoundingClientRect()
    if (appbar === undefined || header === undefined || toolbar === undefined) {
      throw new Error('The editor chrome is missing')
    }
    return {
      toolbarGap: toolbar.top - header.bottom,
      headerGap: header.top - appbar.bottom,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
}

/** The measured header height the sticky toolbar offset is bound to. */
export async function headerHeight(page: Page): Promise<number> {
  return await page.locator('.workspace-header')
    .evaluate(element => element.getBoundingClientRect().height)
}

/** Whether the page scrolls sideways, measured on the real document element. */
export async function horizontalOverflow(page: Page): Promise<boolean> {
  return await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}
