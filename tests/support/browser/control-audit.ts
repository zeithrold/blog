import type { Page, TestInfo } from '@playwright/test'
import { documents as enDocuments } from '@/i18n/resources/en/documents'
import { editor as enEditor } from '@/i18n/resources/en/editor'
import { site as enSite } from '@/i18n/resources/en/site'
import { documents as zhDocuments } from '@/i18n/resources/zh-CN/documents'
import { editor as zhEditor } from '@/i18n/resources/zh-CN/editor'
import { site as zhSite } from '@/i18n/resources/zh-CN/site'
import { controlInventory } from './control-inventory'
import { expect } from './test'

function normalize(name: string): string {
  return name.toLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, ' ').trim()
}
const aliases = new Map<string, string>()
for (const control of controlInventory) {
  for (const name of control.locator.split(' / ')) {
    aliases.set(normalize(name), control.id)
  }
}
const translations = new Map<string, Set<string>>()
function dictionary(en: Record<string, string>, zh: Record<string, string>): void {
  for (const [key, value] of Object.entries(en)) {
    const translated = zh[key]
    if (translated !== undefined) {
      const phrase = normalize(translated)
      const candidates = translations.get(phrase) ?? new Set<string>()
      candidates.add(normalize(value))
      translations.set(phrase, candidates)
    }
  }
}
dictionary(enEditor, zhEditor)
dictionary(enDocuments, zhDocuments)
dictionary(enSite, zhSite)

// Dynamic names identify a control type; the linked suites still verify its behavior.
const publicLinks = /^(?:Skip to content|跳转到内容|Browse writing|浏览文章|Back to top|返回顶部|All writing|全部文章)$/u
const licenseLinks = /^(?:Third.party notices|Dependency inventory|Source offers|.+\.(?:txt|json|md))$/iu

const sourceLinks = new RegExp(
  '^(?:Complete original license|Dependency and bundled.module|ELK.js|Eclipse Layout Kernel'
  + '|Corresponding|MPL 2.0|Shared UI source)',
  'u',
)

const dynamic: { pattern: RegExp, locator: string }[] = [
  { pattern: /^外观$/u, locator: 'Appearance' },
  { pattern: /^语言$/u, locator: 'Language' },
  { pattern: /^(?:跳到内容|Subscribe via RSS|通过 RSS 订阅|第三方许可)$/u, locator: 'RSS / Licenses / Home / Skip to content' },
  { pattern: /^(?:GitHub|hello@ztd.me)$/u, locator: 'Footer contacts' },
  { pattern: /^标题$/u, locator: 'Title' },
  { pattern: /^所选修订$/u, locator: 'Revision / Compare against / Expand change' },
  { pattern: sourceLinks, locator: 'License assets' },
  { pattern: /^(?:Visual journey article|zeithrold\/blog)$/u, locator: 'Document link' },
  { pattern: publicLinks, locator: 'RSS / Licenses / Home / Skip to content' },
  { pattern: /^(?:Documents|文档|Media library|媒体库|Tags|标签|Series|系列|Operations|运行状态)$/u, locator: 'Admin navigation' },
  { pattern: /^(?:More document actions|更多文档操作)$/u, locator: 'More document actions' },
  { pattern: /^(?:Revision|修订) \d+/u, locator: 'Revision / Compare against / Expand change' },
  { pattern: /^(?:Edit table caption:|编辑表格标题：)/u, locator: 'Add caption / Edit table caption' },
  { pattern: /^(?:References|参考文献|文献) \(/u, locator: 'References / Add reference' },
  { pattern: /^(?:Close|关闭)$/u, locator: 'Close dialog' },
  { pattern: /^(?:Light|Dark|System|浅色|深色|跟随系统)$/u, locator: 'Appearance' },
  { pattern: /^(?:English|简体中文)$/u, locator: 'Language' },
  { pattern: licenseLinks, locator: 'License assets' },
]

function contract(name: string): string | undefined {
  const normalized = normalize(name)
  const candidates = [
    normalized,
    ...translations.get(normalized) ?? [],
  ]
  const exact = candidates.map(candidate => aliases.get(candidate)).find(candidate => candidate !== undefined)
  if (exact !== undefined) {
    return exact
  }
  const rule = dynamic.find(entry => entry.pattern.test(name))
  return controlInventory.find(entry => entry.locator === rule?.locator)?.id
}

export async function auditControls(page: Page, info: TestInfo, name: string): Promise<void> {
  const snapshot = await page.locator('body').ariaSnapshot()
  const roles = 'button|link|textbox|searchbox|combobox|checkbox|switch|tab|menuitem\\w*|option|slider|radio'
  const interactive = new RegExp(`^\\s*- '?(${roles})\\b`, 'u')
  const observed = snapshot.split('\n').filter(line => interactive.test(line)).map((line) => {
    const label = /"((?:[^"\\]|\\.)*)"/u.exec(line)?.[1] ?? ''
    return { role: interactive.exec(line)?.[1], label, contract: contract(label) ?? null }
  })
  await info.attach(`controls-${name}.json`, {
    body: JSON.stringify({ url: page.url(), observed }, null, 2),
    contentType: 'application/json',
  })
  expect(observed.length).toBeGreaterThan(0)
  expect.soft(observed.filter(control => control.contract === null), `Unregistered controls at ${name}`).toEqual([])
}
