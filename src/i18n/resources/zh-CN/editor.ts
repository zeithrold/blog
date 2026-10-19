import { catalog } from '@/i18n/resources/zh-CN/catalog'
import { common } from '@/i18n/resources/zh-CN/common'
import { blocks } from '@/i18n/resources/zh-CN/editor/blocks'
import { draft } from '@/i18n/resources/zh-CN/editor/draft'
import { formatting } from '@/i18n/resources/zh-CN/editor/formatting'
import { preview } from '@/i18n/resources/zh-CN/editor/preview'
import { references } from '@/i18n/resources/zh-CN/editor/references'
import { tables } from '@/i18n/resources/zh-CN/editor/tables'
import { workspace } from '@/i18n/resources/zh-CN/editor/workspace'
import { history } from '@/i18n/resources/zh-CN/history'
import { media } from '@/i18n/resources/zh-CN/media'
import { operations } from '@/i18n/resources/zh-CN/operations'
import { publication } from '@/i18n/resources/zh-CN/publication'

export const editor = {
  ...common,
  ...catalog,
  ...media,
  ...operations,
  ...history,
  ...publication,
  ...workspace,
  ...draft,
  ...formatting,
  ...blocks,
  ...tables,
  ...references,
  ...preview,
} as const
