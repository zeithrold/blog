/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
import type { CaseMigration } from './types'
import { adminMigrations } from './admin-migrations'
import { blockRemainingMigrations } from './block-remaining-migrations'
import { editorChromeMigrations } from './editor-chrome-migrations'
import { formattingRemainingMigrations } from './formatting-remaining-migrations'
import { historyMigrations, retainedHistoryCases } from './history-migrations'
import { historyRemainingMigrations } from './history-remaining-migrations'
import { linkRemainingMigrations } from './link-remaining-migrations'
import { mediaMigrations } from './media-migrations'
import { overlayMigrations } from './overlay-migrations'
import { publicationRemainingMigrations } from './publication-remaining-migrations'
import { referenceMigrations } from './reference-migrations'
import { sourceMigrations } from './source-migrations'
import { tableMigrations } from './table-migrations'

// Case-level retirements beyond the first documents/catalog slice. The native
// plans verify that replacements exist and retired cases no longer execute;
// the full component plan remains an execution obligation in the default gate.
export const surfaceMigrations: readonly CaseMigration[] = [
  ...adminMigrations,
  ...editorChromeMigrations,
  ...formattingRemainingMigrations,
  ...linkRemainingMigrations,
  ...mediaMigrations,
  ...overlayMigrations,
  ...referenceMigrations,
  ...sourceMigrations,
  ...tableMigrations,
  ...blockRemainingMigrations,
  ...publicationRemainingMigrations,
  {
    id: 'history.notice-error-conflict',
    legacy: historyMigrations.map(migration => migration.legacy),
    component: historyMigrations.map(migration => ({
      case: migration.component,
      proves: migration.proves,
    })),
    retained: retainedHistoryCases,
  },
  ...historyRemainingMigrations,
  // The reader proof boundary now lives in `reader-dom-migrations`: its single
  // record carries the historical E2E and component keys, the jsdom successors
  // and the four retained native cases, so a second entry here would duplicate
  // ownership of the same legacy keys.
  {
    id: 'editor.formula-layout',
    legacy: [1440, 390].map(width =>
      `tests/browser/editor/source/math-overflow.spec.ts :: formula previews keep natural height and reachable horizontal content at ${width}px`),
    component: [1440, 390].map(width => ({
      case: `tests/components/specs/editor-math.spec.ts :: formula previews keep natural height and reachable horizontal content at ${width}px`,
      proves: [
        'all four real MathView shapes keep natural height and both ends of horizontal content remain reachable',
      ],
    })),
    retained: [
      {
        cases: [1440, 390].map(width =>
          `tests/browser/editor/source/formula-editor.spec.ts :: new block formulas receive typing immediately at ${width}px`),
        reason: 'Real BlockNote container geometry, all four sources during and after editing, native source input and save/reload remain in the existing editor case.',
      },
    ],
  },
  {
    id: 'publication.schedule-timezone',
    legacy: [
      'tests/browser/publication/schedule-timezone.spec.ts :: publication timezone is automatic and searchable in en at 1440px',
      'tests/browser/publication/schedule-timezone.spec.ts :: publication timezone is automatic and searchable in zh at 390px',
    ],
    component: [
      {
        case: 'tests/components/specs/editor-workspace.spec.ts :: publication timezone is automatic and searchable in en at 1440px',
        proves: [
          'the production editor entry loads its session and document over HTTP and renders the loaded title and body',
          'the timezone picker starts on the device zone, searches to Europe/London, restores the device zone and selects UTC by keyboard',
          'the schedule form keeps its subject inside the viewport and passes Axe',
        ],
      },
      {
        case: 'tests/components/specs/editor-workspace.spec.ts :: publication timezone is automatic and searchable in zh at 390px',
        proves: [
          'the Chinese editor opens the publication settings drawer and the scheduled publication form',
          'the timezone picker starts on the device zone, searches to Europe/London, restores the device zone and selects UTC by keyboard',
          'the schedule form keeps its subject inside the viewport and passes Axe',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'publication.preflight',
    legacy: [
      'tests/browser/publication/publication-preflight.spec.ts :: publication preflight updates when diagram source and empty media change',
    ],
    component: [
      {
        case: 'tests/components/specs/editor-preflight.spec.ts :: publication preflight updates when diagram source and empty media change',
        proves: [
          'the issue list names the unsupported diagram and the empty media block in document order',
          'editing the diagram source clears and restores its reason without saving',
          'deleting the empty media block leaves no publication issue',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'publication.locate-blocks',
    legacy: [
      'tests/browser/publication/publication-locate-blocks.spec.ts :: publication locates nested media and its diagram editing control at 1440px',
      'tests/browser/publication/publication-locate-blocks.spec.ts :: publication locates nested media and its diagram editing control at 320px',
      'tests/browser/publication/publication-locate-blocks.spec.ts :: server-only publication reasons remain visible without a matching local block',
    ],
    component: [
      {
        case: 'tests/components/specs/editor-locate.spec.ts :: publication locates nested media and its diagram editing control at 1440px',
        proves: [
          'a locator selects the media block nested in a callout, keeps it in view and returns focus to the body',
          'its control opens the real media dialog with the upload tab and closes again',
          'the diagram locator focuses its editing control and places the caret in the source',
        ],
      },
      {
        case: 'tests/components/specs/editor-locate.spec.ts :: publication locates nested media and its diagram editing control at 320px',
        proves: [
          'a locator selects the media block nested in a callout, keeps it in view and returns focus to the body',
          'its control opens the real media dialog with the upload tab and closes again',
          'the diagram locator focuses its editing control and places the caret in the source',
        ],
      },
      {
        case: 'tests/components/specs/editor-locate.spec.ts :: server-only publication reasons remain visible without a matching local block',
        proves: [
          'a refusal reason with no local block still renders its description',
          'the notice takes focus and offers no locator that cannot resolve',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'publication.locate',
    legacy: [
      'tests/browser/publication/publication-locate.spec.ts :: failed autosave retains publication reasons and typing focus at 1440px',
      'tests/browser/publication/publication-locate.spec.ts :: failed autosave retains publication reasons and typing focus at 320px',
      'tests/browser/publication/publication-locate.spec.ts :: publication summary cycles current table order and returns focus at 1440px',
      'tests/browser/publication/publication-locate.spec.ts :: publication summary cycles current table order and returns focus at 320px',
    ],
    component: [
      {
        case: 'tests/components/specs/editor-locate.spec.ts :: failed autosave retains publication reasons and typing focus at 1440px',
        proves: [
          'a refused save keeps the publication reasons and the typing focus',
          'the retried save reaches its saved state and clears the save error',
        ],
      },
      {
        case: 'tests/components/specs/editor-locate.spec.ts :: failed autosave retains publication reasons and typing focus at 320px',
        proves: [
          'a refused save keeps the publication reasons and the typing focus',
          'the retried save reaches its saved state and clears the save error',
        ],
      },
      {
        case: 'tests/components/specs/editor-locate.spec.ts :: publication summary cycles current table order and returns focus at 1440px',
        proves: [
          'the summary locator focuses each table caption in current document order and closes the settings drawer',
          'after moving a block the next lookup follows the document order rather than the old index',
          'the located settings surface passes Axe',
        ],
      },
      {
        case: 'tests/components/specs/editor-locate.spec.ts :: publication summary cycles current table order and returns focus at 320px',
        proves: [
          'the summary locator focuses each table caption in current document order and closes the settings drawer',
          'after moving a block the next lookup follows the document order rather than the old index',
          'the located settings surface passes Axe',
        ],
      },
    ],
    retained: [
      {
        cases: [
          'tests/browser/publication/publication-locate.spec.ts :: publication preserves reasons and locates each table at 1440px in en',
          'tests/browser/publication/publication-locate.spec.ts :: publication preserves reasons and locates each table at 320px in en',
          'tests/browser/publication/publication-locate.spec.ts :: publication preserves reasons and locates each table at 1440px in zh',
          'tests/browser/publication/publication-locate.spec.ts :: publication preserves reasons and locates each table at 320px in zh',
        ],
        reason: 'Correcting the captions and publishing a real document is the Worker path: it proves the stored captions and the public page, which no component reply can.',
      },
    ],
  },
  {
    id: 'publication.locate-boundaries',
    legacy: [
      'tests/browser/publication/publication-locate-boundaries.spec.ts :: publication target counts follow block deletion and undo at 1440px',
      'tests/browser/publication/publication-locate-boundaries.spec.ts :: publication target counts follow block deletion and undo at 320px',
    ],
    component: [
      {
        case: 'tests/components/specs/editor-locate.spec.ts :: publication target counts follow block deletion and undo at 1440px',
        proves: [
          'deleting one target drops the locator count and finds the remaining block',
          'undo restores the count, and the next lookup continues from the cursor',
          'opening the block menu keeps the scroll position at the wide layout',
        ],
      },
      {
        case: 'tests/components/specs/editor-locate.spec.ts :: publication target counts follow block deletion and undo at 320px',
        proves: [
          'deleting one target drops the locator count and finds the remaining block',
          'undo restores the count, and the next lookup continues from the cursor',
        ],
      },
    ],
    retained: [
      {
        cases: [
          'tests/browser/publication/publication-locate-boundaries.spec.ts :: unpublishing preserves the unresolved draft rejection and its locator',
        ],
        reason: 'Unpublishing is a Worker write: the case proves the live revision is cleared, the public page is gone and the refusal outlives it.',
      },
    ],
  },
]
