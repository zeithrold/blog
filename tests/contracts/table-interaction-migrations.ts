/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
import type { AdminMigrationRecord } from './admin-migrations'

/**
 * The remaining table interaction slice: merged controls and spans, menu-driven
 * moves, composition, localized keyboard help and the slash-table interaction.
 * `legacy` cases are deleted with their component replacement. The slash
 * save/reload E2E case stays as the server representative, so the component
 * case proves the packet while that case keeps the stored table.
 */

const F = {
  overlay: 'tests/browser/editor/tables/table-overlay-polish.spec.ts',
  keyboard: 'tests/browser/editor/tables/table-keyboard-controls.spec.ts',
  drag: 'tests/browser/editor/tables/table-drag.spec.ts',
  merged: 'tests/components/specs/editor-table-merged.spec.ts',
  guards: 'tests/components/specs/editor-table-keyboard-guards.spec.ts',
  slash: 'tests/components/specs/editor-table-slash.spec.ts',
} as const

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}

export const tableInteractionMigrations: readonly AdminMigrationRecord[] = [
  {
    id: 'editor.tables-merged-controls',
    legacy: [
      c(F.overlay, 'merged column controls preserve spans and protect the final group'),
      c(F.overlay, 'merged row controls preserve spans and protect the final group'),
      c(F.keyboard, 'current lower-row cells map to merged column controls at 1440px'),
      c(F.keyboard, 'current lower-row cells map to merged column controls at 320px'),
    ],
    component: [
      {
        case: c(F.merged, 'merged column controls preserve spans and protect the final group'),
        proves: [
          'the merged and final labels stay reachable and the bar exposes two groups',
          'the position-3 insert carries the merged cells and one Undo restores the table',
          'the final group delete is disabled and the next Undo restores the table',
        ],
      },
      {
        case: c(F.merged, 'merged row controls preserve spans and protect the final group'),
        proves: [
          'the merged and final labels stay reachable and the bar exposes two groups',
          'the position-3 insert carries the merged cells and one Undo restores the table',
          'the final group delete is disabled and the next Undo restores the table',
        ],
      },
      {
        case: c(F.merged, 'current lower-row cells map to merged column controls at 1440px'),
        proves: [
          'the lower-row caret maps to the merged column label and Escape returns the caret',
          'the next cell maps to the final column and the menu opens without a revision',
        ],
      },
      {
        case: c(F.merged, 'current lower-row cells map to merged column controls at 320px'),
        proves: [
          'the lower-row caret maps to the merged column label and Escape returns the caret',
          'the next cell maps to the final column and the menu opens without a revision',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.tables-menu-moves',
    legacy: [
      c(F.drag, 'menu offers keyboard row and column moves'),
    ],
    component: [
      {
        case: c(F.merged, 'menu offers keyboard row and column moves'),
        proves: [
          'Move row up reaches the packet and the first cell becomes the moved row',
          'Move column right reaches the packet and the first cell becomes the moved column',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.tables-keyboard-guards',
    legacy: [
      c(F.keyboard, 'composition keeps Alt+F10 in the native cell without changing the document'),
      c(F.keyboard, 'desktop table keyboard help is discoverable in en'),
      c(F.keyboard, 'desktop table keyboard help is discoverable in zh'),
    ],
    component: [
      {
        case: c(F.guards, 'composition keeps Alt+F10 in the native cell without changing the document'),
        proves: [
          'compositionstart keeps Alt+F10 in the body and leaves the caret unchanged',
          'no table menu opens and no revision is sent',
        ],
      },
      {
        case: c(F.guards, 'desktop table keyboard help is discoverable in en'),
        proves: [
          'the hovered table opens its block action list and shows the English Alt+F10/Tab/Escape help',
          'reading the help sends no revision',
        ],
      },
      {
        case: c(F.guards, 'desktop table keyboard help is discoverable in zh'),
        proves: [
          'the hovered table opens its block action list and shows the Chinese Alt+F10/Tab/Escape help',
          'reading the help sends no revision',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.tables-slash',
    legacy: [],
    component: [
      {
        case: c(F.slash, 'native slash table keeps unset widths through middle insertion'),
        proves: [
          'the slash command creates a two-by-three table with unset column widths',
          'typed cell text reaches the packet with the unset widths',
          'the middle insert adds an empty column with unset widths and keeps the typed text',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c(F.overlay, 'native slash table keeps unset widths through middle insertion and reload'),
        ],
        reason: 'The real Worker save/reload keeps the unset widths and the inserted cell: one of the two reload representatives for table persistence.',
      },
    ],
  },
]
