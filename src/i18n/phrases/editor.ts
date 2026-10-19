import { catalog } from '@/i18n/phrases/catalog'
import { common } from '@/i18n/phrases/common'
import { blocks } from '@/i18n/phrases/editor/blocks'
import { draft } from '@/i18n/phrases/editor/draft'
import { formatting } from '@/i18n/phrases/editor/formatting'
import { preview } from '@/i18n/phrases/editor/preview'
import { references } from '@/i18n/phrases/editor/references'
import { tables } from '@/i18n/phrases/editor/tables'
import { workspace } from '@/i18n/phrases/editor/workspace'
import { history } from '@/i18n/phrases/history'
import { media } from '@/i18n/phrases/media'
import { operations } from '@/i18n/phrases/operations'
import { publication } from '@/i18n/phrases/publication'

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
