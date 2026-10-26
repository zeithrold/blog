/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
/**
 * Where each table Playwright case goes, and what remains browser-native.
 *
 * The DOM cases mount production caption, action-list and segment-menu
 * components. Browser cases keep native focus, hover/selection, geometry and
 * live editor transactions; E2E rows keep persistence, reload and physical-touch
 * lineage.
 */

export type DomRetirement = {
  readonly playwright: string
  readonly dom: readonly string[]
  readonly proves: readonly string[]
  readonly remainsBrowser: readonly string[]
}

const componentCaption = 'tests/components/specs/editor-table-caption.spec.ts'
const componentDrag = 'tests/components/specs/editor-table-drag.spec.ts'
const componentInsertion = 'tests/components/specs/editor-table-insertion.spec.ts'
const componentKeyboardGuards = 'tests/components/specs/editor-table-keyboard-guards.spec.ts'
const componentKeyboard = 'tests/components/specs/editor-table-keyboard.spec.ts'
const componentLayout = 'tests/components/specs/editor-table-layout.spec.ts'
const componentMerged = 'tests/components/specs/editor-table-merged.spec.ts'
const componentMobile = 'tests/components/specs/editor-table-mobile.spec.ts'
const componentSlash = 'tests/components/specs/editor-table-slash.spec.ts'
const componentTables = 'tests/components/specs/editor-tables.spec.ts'
const browserCaption = 'tests/browser/editor/tables/table-caption.spec.ts'
const browserDrag = 'tests/browser/editor/tables/table-drag.spec.ts'
const browserDragEdges = 'tests/browser/editor/tables/table-drag-edges.spec.ts'
const browserFormatting = 'tests/browser/editor/tables/formatting-table-position.spec.ts'
const browserSlash = 'tests/browser/editor/tables/table-overlay-polish.spec.ts'
const browserDeletion = 'tests/browser/editor/navigation/content-deletion-boundaries.spec.ts'
const captionDom = 'tests/dom/table-caption.test.tsx'
const guardDom = 'tests/dom/table-segment-guard.test.tsx'
const segmentMenuDom = 'tests/dom/table-segment-menu.test.tsx'
const keyboardHelpDom = 'tests/dom/table-keyboard-help.test.tsx'

function at(file: string, title: string): string {
  return `${file} :: ${title}`
}

function kept(file: string, title: string, ...remainsBrowser: string[]): DomRetirement {
  return {
    playwright: at(file, title),
    dom: [],
    proves: [],
    remainsBrowser,
  }
}

const componentRetirements: readonly DomRetirement[] = [
  {
    playwright: at(componentCaption, 'each table has an independent caption below its viewport at 1440px'),
    dom: [
      at(captionDom, 'keeps each caption in its own accessibility entry and leaves the table blocks unchanged'),
    ],
    proves: [
      'the caption controls expose Add/Edit names and write independent tableAccessibility entries',
      'caption edits and clearing one caption leave the table blocks unchanged and preserve the other caption',
      'the real revision packet carries the captions, and the Content tab has no caption textbox or Media tab',
    ],
    remainsBrowser: [
      'the caption component sits below each live BlockNote table and remains within the 1440px viewport; jsdom has no layout or painted geometry',
    ],
  },
  {
    playwright: at(componentCaption, 'Chinese caption controls focus the input and close on blur or Escape'),
    dom: [],
    proves: [],
    remainsBrowser: [
      'native focus enters the caption input and returns to its button on Escape; clicking another real ProseMirror cell blurs, closes and saves the changed caption',
    ],
  },
  kept(componentDrag, 'desktop row and column drag saves only on drop and Undo restores the order', 'mouse drag previews and drop boundaries depend on pointer delivery and measured table geometry; the real BlockNote transaction is committed only on release', 'the resulting revision packet, Undo and Redo order depend on the live editor history'),
  kept(componentDrag, 'Escape and releasing outside cancel without adding history', 'Escape and outside release cancel a pointer-capture drag against the real editor; jsdom cannot establish pointer capture, table geometry or the BlockNote history result'),
  kept(componentDrag, 'column widths travel with their column and headers keep their region', 'the drop boundary is selected from measured cell coordinates, and the moved columns and header region are the live ProseMirror transaction result'),
  kept(componentDrag, 'merged row groups prevent splitting but allow safe drops', 'drag targets cross merged-cell geometry and commit through the native table map; only a live editor can prove the allowed drop and preserved span'),
  kept(componentDrag, 'merged column groups prevent splitting but allow safe drops', 'drag targets cross merged-cell geometry and commit through the native table map; only a live editor can prove the allowed drop and preserved span'),
  kept(componentDrag, 'mouse clicks insert a middle column and row and Undo keeps the original cells', 'the insertion affordance appears at a measured hover boundary, and click/Undo modify the live ProseMirror table and its history'),
  kept(componentInsertion, 'table column insertion at every boundary saves and Undo restores the cells', 'keyboard focus and Enter are delivered to controls attached to the live table, and every inserted cell plus Undo is a ProseMirror transaction'),
  kept(componentInsertion, 'table row insertion at every boundary saves and Undo restores the cells', 'keyboard focus and Enter are delivered to controls attached to the live table, and every inserted row plus Undo is a ProseMirror transaction'),
  {
    playwright: at(componentInsertion, 'blocked final-segment menus leave the live table unchanged'),
    dom: [
      at(guardDom, 'refuses to remove the only row or column'),
      at(segmentMenuDom, 'last row and column menus expose their labels and disabled delete items'),
    ],
    proves: [
      'the real DOM-derived canRemoveTableSegment guard refuses to remove the only row or column',
      'the production TableSegmentMenu renders the last row and column labels and disabled delete items against the real BlockNote editor target',
    ],
    remainsBrowser: [
      'the integrated editor keeps the one-cell table unchanged and sends no revision when its final-segment menus are opened',
    ],
  },
  kept(componentKeyboardGuards, 'composition keeps Alt+F10 in the native cell without changing the document', 'IME composition, the focused contenteditable, cell caret and Alt+F10 delivery are native BlockNote selection behavior; no revision is the result of that live editor path'),
  {
    playwright: at(componentKeyboardGuards, 'desktop keyboard help follows the hovered table block in en'),
    dom: [
      at(keyboardHelpDom, 'BlockActionsList renders the en keyboard help only for table blocks'),
    ],
    proves: [
      'the production BlockActionsList renders the English help only for a table block',
      'the paragraph conditional omits the help and table-header actions',
    ],
    remainsBrowser: [
      'hovering the production editor selects the correct table block, and the help uses the computed desktop display rule',
    ],
  },
  {
    playwright: at(componentKeyboardGuards, 'desktop keyboard help follows the hovered table block in zh'),
    dom: [
      at(keyboardHelpDom, 'BlockActionsList renders the zh keyboard help only for table blocks'),
    ],
    proves: [
      'the production BlockActionsList renders the Chinese help only for a table block',
      'the paragraph conditional omits the help and table-header actions',
    ],
    remainsBrowser: [
      'hovering the production editor selects the correct table block, and the help uses the computed desktop display rule',
    ],
  },
  kept(componentKeyboard, 'cell keys reach the current table column and row controls at 1440px', 'Tab, arrows, Alt+F10 and Escape operate on a real ProseMirror cell selection, and menu/control horizontal bounds require the browser layout engine'),
  kept(componentKeyboard, 'cell keys reach the current table column and row controls at 320px', 'Tab, arrows, Alt+F10 and Escape operate on a real ProseMirror cell selection, and compact menu/control geometry requires the browser layout engine'),
  kept(componentKeyboard, 'keyboard column insertion saves one revision and Undo restores the table', 'the keyboard menu command dispatches a live table transaction and the restored document comes from the editor history'),
  kept(componentKeyboard, 'pending operations reject the table control shortcut in the read-only editor', 'a held publish keeps the production editor read-only while native Alt+F10 is delivered to its contenteditable; no table action or revision may escape'),
  kept(componentKeyboard, 'table formatting preserves its range below the selection at 1440px', 'the selected text range and formatting transaction belong to ProseMirror; toolbar placement below the range is measured browser geometry'),
  kept(componentLayout, 'table aligns with paragraph, code and formula while desktop controls toggle', 'block-to-table alignment, opacity, menu bounds and overlay placement are computed from real CSS layout and hover/focus'),
  kept(componentLayout, 'mobile table aligns at 390 and 320px with its controls outside the body', 'compact alignment, overflow, scrollbar position and the control hit regions require mobile layout and native scrolling'),
  kept(componentLayout, 'wide table thumb drag and keyboard scrolling work at 1440 and 390px', 'thumb dragging, Home/End/arrow scrolling, cell bounds and offscreen focus all depend on native scroll geometry'),
  kept(componentLayout, 'mobile table grips stay reachable with block actions above the table', '44px touch targets, viewport containment, side-control alignment and the block-action dialog are browser geometry and painted-state assertions'),
  {
    playwright: at(componentMerged, 'merged column edits preserve spans and Undo restores the final group'),
    dom: [
      at(guardDom, 'refuses to remove a merged column spanning the final column group'),
      at(segmentMenuDom, 'a merged column menu labels the full group and disables deletion'),
    ],
    proves: [
      'the real tableAxisSpan and canRemoveTableSegment functions refuse to remove a merged column group spanning all columns',
      'the production TableSegmentMenu renders the merged column range and disabled delete item',
    ],
    remainsBrowser: ['insertion/deletion transactions, span preservation and Undo require the live ProseMirror table'],
  },
  {
    playwright: at(componentMerged, 'merged row edits preserve spans and Undo restores the final group'),
    dom: [
      at(guardDom, 'refuses to remove a merged row spanning the final row group'),
      at(segmentMenuDom, 'a merged row menu labels the full group and disables deletion'),
    ],
    proves: [
      'the real tableAxisSpan and canRemoveTableSegment functions refuse to remove a merged row group spanning all rows',
      'the production TableSegmentMenu renders the merged row range and disabled delete item',
    ],
    remainsBrowser: ['insertion/deletion transactions, span preservation and Undo require the live ProseMirror table'],
  },
  kept(componentMerged, 'menu offers keyboard row and column moves', 'the row/column menu commands dispatch live BlockNote transactions and the saved table order comes from the production editor'),
  kept(componentMerged, 'current lower-row cells map to merged column controls at 1440px', 'the selected lower-row cell, merged-column mapping, Tab navigation and Escape restoration depend on ProseMirror selection'),
  kept(componentMerged, 'current lower-row cells map to merged column controls at 320px', 'the selected lower-row cell and merged-column keyboard mapping depend on ProseMirror selection; compact controls also require native responsive geometry'),
  kept(componentMobile, 'mobile table grips follow the touched cell at 320px', 'touch selection chooses the active cell, 44px grip geometry and viewport bounds are native browser facts, and menu edits use the live editor'),
  kept(componentMobile, 'mobile table grips follow the touched cell at 390px', 'touch selection chooses the active cell, 44px grip geometry and viewport bounds are native browser facts, and menu edits use the live editor'),
  kept(componentMobile, 'mobile table grips follow the touched cell at 486px', 'touch selection chooses the active cell, 44px grip geometry and viewport bounds are native browser facts, and menu edits use the live editor'),
  kept(componentMobile, 'row drag scrolls the page and cancels without moving content', 'page-edge auto-scroll, Escape and pointer release are native touch/scroll behavior, and the no-move result is the live BlockNote transaction state'),
  kept(componentSlash, 'native slash table keeps unset widths through middle insertion', 'the slash picker, typing into a contenteditable table and middle insertion run through the live BlockNote editor; the packet is read after that native transaction'),
  kept(componentTables, 'table option menus add and delete rows and columns and keep the bar geometry', 'the add/delete commands mutate the live ProseMirror table; bar, menu and block-action bounds and computed styling require a browser layout engine'),
  kept(componentTables, 'native column resizing saves widths and Undo restores the original table', 'pointer resizing is computed from native cell geometry and updates a live BlockNote table transaction followed by Undo'),
  kept(componentTables, 'native minimum and maximum column widths save and remain one Undo', 'minimum/maximum drag limits are exercised through measured pointer movement and native table resizing history'),
]

const browserRetirements: readonly DomRetirement[] = [
  kept(browserFormatting, 'table formatting preserves its range below the selection at 390px', 'the cell selection, formatting toolbar position and italic transaction require live ProseMirror and browser geometry; the E2E case also reads the saved Worker document after reload'),
  {
    playwright: at(browserCaption, 'each table has an independent caption below its viewport at 390px'),
    dom: [
      at(captionDom, 'keeps each caption in its own accessibility entry and leaves the table blocks unchanged'),
    ],
    proves: ['caption state, independent tableAccessibility fields and the save packet are carried by the DOM case'],
    remainsBrowser: [
      'the E2E case keeps compact 390px caption/table geometry, persistence through the real Worker/D1, and the caption display after page reload',
    ],
  },
  kept(browserDrag, 'long press row handle reorders and stays usable', 'Chromium CDP physical touch, long-press timing, merged table geometry and persisted Worker order are not present in jsdom'),
  kept(browserDrag, 'long press column handle reorders and stays usable', 'Chromium CDP physical touch, long-press timing, merged table geometry and persisted Worker order are not present in jsdom'),
  kept(browserDrag, 'early touch movement and system cancellation leave content intact', 'physical touch start/move/cancel delivery and the unchanged persisted Worker document require the native browser and real storage'),
  kept(browserDragEdges, 'touch column drag scrolls a wide table without releasing', 'physical touch edge scrolling, viewport scroll position, drag completion and persisted column order require Chromium and the real Worker'),
  kept(browserSlash, 'native slash table keeps unset widths through middle insertion and reload', 'slash insertion, contenteditable typing, table mutation and the save/reload read-back use the live editor and Worker/D1'),
  kept(browserDeletion, 'rich paste after deleting an annotated table preserves undo metadata', 'deleting and restoring a live table around rich paste exercises ProseMirror history and the persisted accessibility envelope'),
]

export const domRetirements: readonly DomRetirement[] = [
  ...componentRetirements,
  ...browserRetirements,
]

/** Execution boundaries for interpreting the table DOM migration map. */
export const domGatePrerequisites: readonly string[] = [
  'Use vitest.dom.config.ts and tests/dom/setup.ts; their HTTP boundary requires declared responses and is not a Worker or persistence proof.',
  'table-support.tsx mounts the real TableCaption, EditorSettings, document model, draft controller and Client with the accepted editor boundary; it does not mount BlockNote.',
  'The table menu cases separately mount BlockNoteViewRaw, the real BlockNote editor and target, and the production TableSegmentMenu through its existing SegmentProps interface.',
  'jsdom has no layout, painted bounds, browser scrolling, physical touch or native browser input. Retained cases in those categories require their Playwright layer.',
  'This mapping names lineage and successors; it is not test execution evidence or an integration into the global DOM migration ledger.',
]
