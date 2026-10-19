import { createExtension } from '@blocknote/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { TABLE_COLUMN_MAX_WIDTH, TABLE_COLUMN_MIN_WIDTH } from '@/content/table-limits'

function boundedWidths(value: unknown): unknown[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const widths = value.map((width: unknown) => {
    // A native zero slot is an unset width in a cell spanning multiple columns.
    if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
      return width
    }
    const bounded = Math.min(TABLE_COLUMN_MAX_WIDTH, Math.max(TABLE_COLUMN_MIN_WIDTH, width))
    return bounded
  })
  return widths.some((width, index) => width !== value[index]) ? widths : null
}

export const tableWidthLimits = createExtension({
  key: 'blogTableWidthLimits',
  prosemirrorPlugins: [
    new Plugin({
      key: new PluginKey('blogTableWidthLimits'),
      appendTransaction: (transactions, _previous, state) => {
        if (!transactions.some(transaction => transaction.docChanged)) {
          return null
        }
        const correction = state.tr
        state.doc.descendants((node, position) => {
          const role: unknown = node.type.spec.tableRole
          if (role !== 'cell' && role !== 'header_cell') {
            return
          }
          const widths = boundedWidths(node.attrs.colwidth)
          if (widths !== null) {
            correction.setNodeMarkup(position, undefined, { ...node.attrs, colwidth: widths }, node.marks)
          }
          return false
        })
        // Appended steps join the initiating native resize's history event.
        return correction.docChanged ? correction : null
      },
    }),
  ],
})
