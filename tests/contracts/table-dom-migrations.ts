/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
import type { DomMigrationRecord } from './dom-migrations'

const e2eCaption = 'tests/browser/editor/tables/table-caption.spec.ts'
const caption = 'tests/components/specs/editor-table-caption.spec.ts'
const insertion = 'tests/components/specs/editor-table-insertion.spec.ts'
const merged = 'tests/components/specs/editor-table-merged.spec.ts'
const captionDom = 'tests/dom/table-caption.test.tsx'
const guardDom = 'tests/dom/table-segment-guard.test.tsx'
const segmentMenuDom = 'tests/dom/table-segment-menu.test.tsx'
const keyboardHelpDom = 'tests/dom/table-keyboard-help.test.tsx'

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

/**
 * The table generation moves caption data and table-menu rendering into jsdom.
 * Browser cases keep native focus, hover/selection, layout, and live editor
 * transactions that the DOM layer cannot establish.
 */
export const tableDomMigrations: readonly DomMigrationRecord[] = [
  {
    id: 'table.caption-metadata',
    legacy: [
      at(caption, 'each table has an independent caption below its viewport at 1440px'),
      at(e2eCaption, 'each table has an independent caption below its viewport at 390px'),
    ],
    dom: [
      {
        case: at(captionDom, 'keeps each caption in its own accessibility entry and leaves the table blocks unchanged'),
        contracts: [],
        proves: [
          'two real TableCaption components expose Add caption and edit separate tableAccessibility entries',
          'caption edits and clearing one caption leave the table blocks unchanged and preserve the other caption',
          'the revision packet contains the independent caption values and the Content tab has no caption textbox or Media tab',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(caption, 'each table has an independent caption below its viewport at 1440px'),
        ],
        reason: 'Split, not retired: jsdom carries the controls and revision-packet assertions. This component case keeps the live table and caption rectangles below the viewport and within its 1440px horizontal bounds. Its title is the retained registration identity from before the narrowing; the wider wording is known naming debt, so this native residual is read only as geometry.',
      },
      {
        cases: [
          at(e2eCaption, 'each table has an independent caption below its viewport at 390px'),
        ],
        reason: 'Split, not retired: jsdom carries caption state and packet assertions. This E2E case keeps compact 390px geometry, the real Worker/D1 persistence read, and caption survival after a page reload.',
      },
    ],
  },
  {
    id: 'table.segment-removal',
    legacy: [
      at(insertion, 'blocked final-segment menus leave the live table unchanged'),
      at(merged, 'merged column edits preserve spans and Undo restores the final group'),
      at(merged, 'merged row edits preserve spans and Undo restores the final group'),
    ],
    dom: [
      {
        case: at(guardDom, 'refuses to remove the only row or column'),
        contracts: [],
        proves: ['the real canRemoveTableSegment guard refuses to remove the only row or column of a one-cell table'],
      },
      {
        case: at(guardDom, 'refuses to remove a merged row spanning the final row group'),
        contracts: [],
        proves: ['the real tableAxisSpan and canRemoveTableSegment functions preserve the final merged row group'],
      },
      {
        case: at(guardDom, 'refuses to remove a merged column spanning the final column group'),
        contracts: [],
        proves: ['the real tableAxisSpan and canRemoveTableSegment functions preserve the final merged column group'],
      },
      {
        case: at(segmentMenuDom, 'last row and column menus expose their labels and disabled delete items'),
        contracts: [],
        proves: [
          'the production TableSegmentMenu renders Row 1 and Column 1 labels and disables deletion using the real one-cell BlockNote table target',
        ],
      },
      {
        case: at(segmentMenuDom, 'a merged row menu labels the full group and disables deletion'),
        contracts: [],
        proves: [
          'the production TableSegmentMenu renders the real merged row span in its label and disables deletion for the final row group',
        ],
      },
      {
        case: at(segmentMenuDom, 'a merged column menu labels the full group and disables deletion'),
        contracts: [],
        proves: [
          'the production TableSegmentMenu renders the real merged column span in its label and disables deletion for the final column group',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at(insertion, 'blocked final-segment menus leave the live table unchanged'),
        ],
        reason: 'Split, not retired: jsdom mounts the production TableSegmentMenu against a real BlockNote editor and proves its final-segment labels and disabled items. The browser case keeps the integrated editor table and no-revision result.',
      },
      {
        cases: [
          at(merged, 'merged column edits preserve spans and Undo restores the final group'),
          at(merged, 'merged row edits preserve spans and Undo restores the final group'),
        ],
        reason: 'Split, not retired: jsdom proves merged labels, spans and disabled menu items on the production TableSegmentMenu. These component cases keep live insertion/deletion transactions, span preservation and Undo on the BlockNote table.',
      },
    ],
  },
  {
    id: 'table.keyboard-help',
    legacy: [
      at('tests/components/specs/editor-table-keyboard-guards.spec.ts', 'desktop keyboard help follows the hovered table block in en'),
      at('tests/components/specs/editor-table-keyboard-guards.spec.ts', 'desktop keyboard help follows the hovered table block in zh'),
    ],
    dom: [
      {
        case: at(keyboardHelpDom, 'BlockActionsList renders the en keyboard help only for table blocks'),
        contracts: [],
        proves: [
          'the production BlockActionsList renders English keyboard help through BlogFrontend/i18next and table-only header actions through BlockNote',
          'the help and header actions are absent for a real non-table block',
        ],
      },
      {
        case: at(keyboardHelpDom, 'BlockActionsList renders the zh keyboard help only for table blocks'),
        contracts: [],
        proves: [
          'the production BlockActionsList renders Chinese keyboard help through BlogFrontend/i18next and table-only header actions through BlockNote',
          'the help and header actions are absent for a real non-table block',
        ],
      },
    ],
    retained: [
      {
        cases: [
          at('tests/components/specs/editor-table-keyboard-guards.spec.ts', 'desktop keyboard help follows the hovered table block in en'),
          at('tests/components/specs/editor-table-keyboard-guards.spec.ts', 'desktop keyboard help follows the hovered table block in zh'),
        ],
        reason: 'Split, not retired: the DOM case proves bilingual copy and conditional rendering. The browser cases keep hover, selected block identity and the computed desktop display rule.',
      },
    ],
  },
]
