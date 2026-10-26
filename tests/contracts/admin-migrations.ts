/* eslint-disable style/max-len, max-lines -- One flat table maps every retired admin case to its component cases. */
import type { CaseMigration } from './types'

/**
 * Where the retired admin shell browser cases now run.
 *
 * `legacy` names the E2E case that owned the assertion, `component` names the
 * component browser case that proves it against the real `SiteShell` chrome
 * (or the shell plus the real document list for the filter Selects), and
 * `proves` lists the original assertions that case covers. The admin shell has
 * no rule ledger of its own, so this table records the case mapping only and the
 * gate integration it feeds stays with the contracts registry.
 *
 * Retained cases stay in the real E2E suite because only the routed application
 * can prove them: choosing a section is a Next route push, and the shell reads
 * its section from the routed pathname there. The editor cases run on the real
 * editor entry over an explicit HTTP boundary, so draft saves and the publish
 * write are acknowledged by the case, while D1 persistence and the real route
 * stay with the representative E2E cases.
 *
 * Control inventory affected by the retired E2E files: every row of the `shell`
 * surface in `tests/support/browser/control-inventory.ts` listed
 * `admin/admin-navigation-motion` as evidence (`shell.appearance`,
 * `shell.language`, `shell.admin-navigation`, `shell.more-document-actions`,
 * `shell.close-dialog`, `shell.footer-contacts`, `shell.license-assets`,
 * `shell.view-site`). That entry now names this migration's component spec
 * (`tests/components/specs/admin-navigation.spec.ts`), so those rows hold once
 * the legacy gate resolves explicit component evidence paths and the native
 * case plan covers the component suite. `admin/select-polish` never had an
 * inventory row, so retiring it changes no control mapping.
 */

export type AdminMigrationCase = string
export type AdminMigrationRecord = CaseMigration

const F = {
  menuMotion: 'tests/browser/admin/admin-navigation-motion.spec.ts',
  actionPolish: 'tests/browser/admin/action-polish.spec.ts',
  selectPolish: 'tests/browser/admin/select-polish.spec.ts',
  dialogMotion: 'tests/browser/admin/dialog-motion.spec.ts',
  inspectorGroup: 'tests/browser/admin/inspector-group-polish.spec.ts',
  adminPolish: 'tests/browser/admin/admin-polish.spec.ts',
  appearance: 'tests/browser/admin/appearance.spec.ts',
  adminManagement: 'tests/browser/admin/admin-management.spec.ts',
  services: 'tests/browser/admin/services.spec.ts',
  catalogControls: 'tests/browser/catalog/catalog-controls-polish.spec.ts',
  publicationJourney: 'tests/browser/journeys/publication.spec.ts',
  fullServices: 'tests/integration/full-services.integration.ts',
  presentation: 'tests/browser/journeys/presentation.spec.ts',
  navigation: 'tests/components/specs/admin-navigation.spec.ts',
  controls: 'tests/components/specs/admin-controls.spec.ts',
  editorUi: 'tests/components/specs/admin-editor-ui.spec.ts',
  editorState: 'tests/components/specs/admin-editor-state.spec.ts',
  editorServices: 'tests/components/specs/admin-editor-services.spec.ts',
} as const

function c(file: string, title: string): AdminMigrationCase {
  return `${file} :: ${title}`
}

const openAndClose = 'compact admin menu animates opening and closing'
const reducedMotion = 'compact admin menu keeps reduced motion, arrow keys and focus return at 390px'
const spacing = 'compact admin navigation keeps vertical space around its trigger'
const adminSelects = 'admin Selects keep one text gutter, a centered right check and animate in and out'
const compactSelects = 'compact admin Selects keep options aligned and respect reduced motion at 320px'
const publicationActions = 'publication actions describe the live state and draft sync stays in the menu'
const bodyMenuFocus = 'clicking the document body outside its desktop actions menu preserves the writing focus'
const centeredDialog = 'dialog remains centered throughout opening and closing'
const singleScroll = 'settings retain one scroll container and plain catalog fields'
const blockActions = 'block actions form a vertical menu below horizontal side controls'
const inspectorTabs = 'inspector tabs preserve local settings and bilingual changes keep the native editor identity'
const appearanceStates = '36 bilingual appearance states preserve the editor and have no axe violations'
const compactDrawer = 'compact settings drawer keeps keyboard focus and axe on the editor at 320px'
const badgeGeometry = 'status badges share one geometry across locales and narrow layouts'
const badgeParity = 'the unsaved-changes status keeps one appearance between the editor and the catalog page'
const pasteSanitizer = 'bounded HTML paste preserves supported formatting and removes active content'
const scheduleLock = 'scheduling locks publication and keeps the editor mounted while the request is pending'
const catalogSnapshot = 'catalog snapshots reach the save packet from the editor'

const animationProves = [
  'opening sets data-state=open and plays ztd-menu-enter at 0.15s',
  'the Media library menu item is visible while the menu is open',
  'Escape closes to data-state=closed and plays ztd-menu-exit at 0.1s',
  'the finished exit animation unmounts the menu and focuses its trigger',
]

export const adminMigrations: readonly AdminMigrationRecord[] = [
  {
    id: 'admin.section-menu-animation',
    legacy: [
      c(F.menuMotion, 'admin section menu animates opening and closing at 390px'),
      c(F.menuMotion, 'admin section menu animates opening and closing at 800px'),
    ],
    component: [
      {
        case: c(F.navigation, `${openAndClose} at 390px`),
        proves: animationProves,
      },
      {
        case: c(F.navigation, `${openAndClose} at 800px`),
        proves: animationProves,
      },
    ],
    retained: [],
  },
  {
    id: 'admin.section-menu-keyboard',
    legacy: [
      c(F.menuMotion, 'admin section menu respects reduced motion and keyboard navigation'),
    ],
    component: [
      {
        case: c(F.navigation, reducedMotion),
        proves: [
          'reduced motion leaves the open menu without an animation',
          'opening moves focus to the Documents menu item',
          'ArrowDown moves focus to Media library',
          'Escape closes the menu and returns focus to the trigger',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c(F.presentation, 'accessibility scanner: late controls retain layout, focus and interaction contracts'),
        ],
        reason: 'Every width/locale/browser variant of this journey opens the compact menu and leaves through a section item, asserting the destination URL; that is a Next route push, not chrome behaviour.',
      },
    ],
  },
  {
    id: 'admin.compact-navigation-spacing',
    legacy: [
      c(F.actionPolish, 'compact administration navigation leaves vertical space around its trigger'),
    ],
    component: [
      {
        case: c(F.navigation, spacing),
        proves: [
          'the trigger is labelled by the section the shell is mounted on',
          'at 320, 390 and 768px the trigger keeps at least 7px above and below inside the navigation bar',
          'no width scrolls the page horizontally',
          'triggering the menu lists every section',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'admin.control-selects',
    legacy: [
      c(F.selectPolish, 'Select options retain one text gutter, show a centered right check and animate in and out'),
    ],
    component: [
      {
        case: c(F.controls, adminSelects),
        proves: [
          'the document type filter opens as a bottom popper that plays ztd-menu-enter',
          'each option keeps one 11-13px text gutter, a static text position and no outline',
          'exactly one option shows a right-aligned check 11-13px inside the row and centered within 1px',
          'ArrowDown moves focus to the Post option',
          'Escape plays ztd-menu-exit, unmounts the menu and returns focus to the trigger',
          'the language menu keeps the same option geometry and enter animation',
          'the appearance menu marks exactly two checked choices whose indicator keeps a 12px right inset',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'admin.control-selects-reduced-motion',
    legacy: [
      c(F.selectPolish, 'compact Select keeps options aligned and respects reduced motion'),
    ],
    component: [
      {
        case: c(F.controls, compactSelects),
        proves: [
          'at 320px the Chinese document type and language Selects keep the same option geometry',
          'under reduced motion both menus open without an animation',
          'the page does not scroll horizontally',
          'Escape closes the menu and returns focus to the trigger',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'admin.publication-actions',
    legacy: [
      c(F.actionPolish, 'publication actions describe the live state while draft synchronization stays in the menu'),
    ],
    component: [
      {
        case: c(F.editorUi, publicationActions),
        proves: [
          'a fresh draft offers Publish, no Save and no Publish draft action',
          'the document actions menu lists a disabled Sync draft now',
          'the Chinese header offers 发布 and no 保存, and publishing it turns the action into 更新发布',
          'switching back to English keeps the published action as Update publication',
          'the publish write is attempted against the document publish route',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'admin.document-menu-focus',
    legacy: [
      c(F.actionPolish, bodyMenuFocus),
    ],
    component: [
      {
        case: c(F.editorUi, bodyMenuFocus),
        proves: [
          'clicking the body dismisses the open document actions menu',
          'the body keeps focus and accepts the next keystrokes',
          'the saved acknowledgement carries the typed text instead of an unconfirmed local edit',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'admin.preview-dialog-geometry',
    legacy: [
      c(F.dialogMotion, 'dialog remains centered throughout opening and closing at 390px'),
      c(F.dialogMotion, 'dialog remains centered throughout opening and closing at 1440px'),
    ],
    component: [
      {
        case: c(F.editorUi, `${centeredDialog} at 390px`),
        proves: [
          'every sampled frame of the enter and exit animation keeps the dialog on the viewport centre',
          'Close preview owns focus on open and the Preview trigger regains it on close',
        ],
      },
      {
        case: c(F.editorUi, `${centeredDialog} at 1440px`),
        proves: [
          'the same frame-by-frame centring holds at the desktop width',
          'the dialog unmounts once its exit animation finishes',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'admin.inspector-single-scroll',
    legacy: [
      c(F.inspectorGroup, 'settings retain one scroll container and plain catalog fields at 320px'),
      c(F.inspectorGroup, 'settings retain one scroll container and plain catalog fields at 700px'),
    ],
    component: [
      {
        case: c(F.editorUi, `${singleScroll} at 320px`),
        proves: [
          'the drawer clips its own overflow and scrolls only inside the ztd scroll viewport',
          'the catalog fields are plain labelled Selects, not fieldsets',
          'the heading and Close control stay in view while the region scrolls',
          'closing returns focus to the settings trigger without horizontal overflow',
        ],
      },
      {
        case: c(F.editorUi, `${singleScroll} at 700px`),
        proves: ['the same single scroll container holds at the wider drawer width'],
      },
    ],
    retained: [],
  },
  {
    id: 'admin.block-actions-layout',
    legacy: [
      c(F.inspectorGroup, 'block actions form a vertical menu below horizontal side controls at 320px'),
      c(F.inspectorGroup, 'block actions form a vertical menu below horizontal side controls at 1440px'),
    ],
    component: [
      {
        case: c(F.editorUi, `${blockActions} at 320px`),
        proves: [
          'Add block and Open block menu share one baseline on the horizontal side controls',
          'the open action list stacks two equal-width actions vertically inside the viewport',
          'Delete owns focus, Escape closes the menu and the page does not scroll horizontally',
        ],
      },
      {
        case: c(F.editorUi, `${blockActions} at 1440px`),
        proves: ['the desktop action list keeps its vertical geometry and full opacity'],
      },
    ],
    retained: [],
  },
  {
    id: 'admin.inspector-tabs',
    legacy: [
      c(F.adminPolish, inspectorTabs),
    ],
    component: [
      {
        case: c(F.editorState, inspectorTabs),
        proves: [
          'a chosen timezone survives switching to Content and back to Publication',
          'switching the interface to Chinese translates the tabs and the 发布/发布时区 controls',
          'the English body text and the same editor node survive the language switch',
          'no page error is raised (the component run fails on any uncaught page error)',
          'the only write is the acknowledged draft save',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'admin.appearance-states',
    legacy: [
      c(F.appearance, appearanceStates),
    ],
    component: [
      {
        case: c(F.editorState, appearanceStates),
        describe: ['accessibility scanner'],
        proves: [
          'all 36 mode/palette/language states have no axe violations on the real editor',
          'the appearance menu closes after each choice',
          'the editor keeps its node and its English body text through every state',
          'appearance changes write nothing, so the stored draft revision cannot move',
        ],
      },
    ],
    retained: [],
    notMigrated: [
      {
        cases: [
          c(F.appearance, appearanceStates),
        ],
        reason: 'The legacy case also re-read the document over the API and compared headRevisionId before and after. The component case proves the stronger browser fact that appearance changes attempt no write at all; the stored revision is the server-side half and needs the real Worker.',
      },
    ],
  },
  {
    id: 'admin.compact-inspector-overlay',
    legacy: [
      c(F.adminPolish, 'compact navigation, filters and inspector use keyboard accessible overlays at 320px'),
    ],
    component: [
      {
        case: c(F.editorState, compactDrawer),
        describe: ['accessibility scanner'],
        proves: [
          'the settings drawer opens at 320px and its tabs fit without horizontal scrolling',
          'the drawer has no axe violations and the page does not scroll horizontally',
          'closing returns focus to the settings trigger and keeps the written body text',
        ],
      },
      {
        case: c(F.controls, compactSelects),
        proves: ['the publication-state style Select keeps one option geometry and returns focus on Escape'],
      },
    ],
    retained: [
      {
        cases: [
          c(F.presentation, 'accessibility scanner: late controls retain layout, focus and interaction contracts'),
          c(F.adminManagement, 'global media uploads remain private and operations show real counters'),
        ],
        reason: 'The routed half stays with real navigation: the presentation journey selects every admin section through the compact menu and asserts the destination URL, a rendered heading and answered data, and the management case asserts the Operations panel summary. The overlay assertions the retired case also carried are the two component cases above plus the block-action case.',
      },
    ],
  },
  {
    id: 'admin.status-badges',
    legacy: [
      c(F.actionPolish, 'status badges share geometry across locales and narrow layouts'),
    ],
    component: [
      {
        case: c(F.editorState, badgeGeometry),
        proves: [
          'the save status and the draft badge compute identical geometry in the editor header',
          'the badge is 26px tall with a 6px dot at 1440px, at 320px and in Chinese',
          'the dirty status keeps its own padding at every width and language',
          'the acknowledged save leaves the badge on its saved state and nothing scrolls horizontally',
        ],
      },
      {
        case: c(F.editorState, badgeParity),
        proves: [
          'the same SaveStatus renders the dirty state with one identical computed appearance in the editor header and on the catalog page',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'admin.paste-sanitizer',
    legacy: [
      c(F.services, pasteSanitizer),
    ],
    component: [
      {
        case: c(F.editorServices, pasteSanitizer),
        proves: [
          'a pasted heading and bold run stay in the native editor as formatted blocks',
          'a javascript: link and a script element never reach the rendered body',
          'the acknowledged save packet carries a heading block and unique block ids',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'admin.schedule-lock',
    legacy: [
      c(F.services, 'scheduling locks publication and keeps the native editor mounted while the request is pending'),
    ],
    component: [
      {
        case: c(F.editorServices, scheduleLock),
        proves: [
          'the held schedule submit disables Publish and makes the editor read-only',
          'releasing it renders the pending job with Cancel schedule and re-enables Publish and the editor',
          'the editor node stays mounted through the pending request',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'admin.editor-catalog-snapshot',
    legacy: [
      c(F.services, 'catalog snapshots and schedule pinning are usable from the editor'),
    ],
    component: [
      {
        case: c(F.editorServices, catalogSnapshot),
        proves: ['a catalog entry chosen in the inspector reaches the save packet with its id and label'],
      },
    ],
    retained: [
      {
        cases: [
          c(F.catalogControls, 'catalog Selects search, support multiple tags and replace series'),
          c(F.publicationJourney, 'long task: fix preflight, pin and cancel schedules, recover authentication and resume maintenance'),
          c(F.adminManagement, 'global media uploads remain private and operations show real counters'),
        ],
        reason: 'The retired case also asserted three server facts. The inspector Select behaviour stays with the editor catalog case, schedule revision pinning and the newer draft staying private stay with the publication journey (pending job revisionId and public HTML), and the Operations summary stays with the management case.',
      },
    ],
    notMigrated: [
      {
        cases: [
          c(F.fullServices, 'full services against one Worker'),
        ],
        reason: 'A document saved with catalog tag metadata is proved at the integration layer: the runtime flow stores meta.tags, publishes it and renames the tag, so no browser case has to re-check stored metadata.',
      },
    ],
  },
]
