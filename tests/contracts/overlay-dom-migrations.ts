import type { DomMigrationRecord } from './dom-migrations'

/**
 * No component overlay assertion moved to jsdom in this batch. The retained
 * cases and the reasons are enumerated in `tests/dom/editor-overlay-retirements.ts`.
 */
export const overlayDomMigrations: readonly DomMigrationRecord[] = []
