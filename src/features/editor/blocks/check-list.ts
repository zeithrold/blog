import { createCheckListItemBlockSpec } from '@blocknote/core'
import { createReactBlockSpec } from '@blocknote/react'
import { ChecklistExport, ChecklistView } from '@/features/editor/blocks/check-list-view'

export const nativeChecklist = createCheckListItemBlockSpec()

// Retain native parsing, input rules, Enter and Mod-Shift-9; adapt only the UI.
export const checkListItem = createReactBlockSpec(nativeChecklist.config, {
  meta: nativeChecklist.implementation.meta,
  parse: nativeChecklist.implementation.parse,
  parseContent: nativeChecklist.implementation.parseContent,
  runsBefore: nativeChecklist.implementation.runsBefore,
  render: ChecklistView,
  toExternalHTML: ChecklistExport,
}, nativeChecklist.extensions)()
