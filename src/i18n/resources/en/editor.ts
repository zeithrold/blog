import { catalog } from '@/i18n/resources/en/catalog'
import { common } from '@/i18n/resources/en/common'
import { blocks } from '@/i18n/resources/en/editor/blocks'
import { draft } from '@/i18n/resources/en/editor/draft'
import { formatting } from '@/i18n/resources/en/editor/formatting'
import { preview } from '@/i18n/resources/en/editor/preview'
import { references } from '@/i18n/resources/en/editor/references'
import { tables } from '@/i18n/resources/en/editor/tables'
import { workspace } from '@/i18n/resources/en/editor/workspace'
import { history } from '@/i18n/resources/en/history'
import { media } from '@/i18n/resources/en/media'
import { operations } from '@/i18n/resources/en/operations'
import { publication } from '@/i18n/resources/en/publication'

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
