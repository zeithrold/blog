export type ControlContract = {
  id: string
  surface: string
  locator: string
  widths: readonly number[]
  states: readonly string[]
  behavior: string
  evidence: readonly string[]
}

export function controls(
  surface: string,
  evidence: readonly string[],
  states: readonly string[],
  rows: readonly (readonly [string, string])[],
): ControlContract[] {
  return rows.map(([locator, behavior]) => ({
    id: `${surface}.${locator.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    surface,
    locator,
    widths: [
      320,
      390,
      1440,
    ],
    states,
    behavior,
    // Existing short names select E2E; explicit paths allow a migrated control
    // to point directly at its real-component replacement instead.
    evidence: evidence.map(file => file.startsWith('tests/') ? file : `tests/browser/${file}.spec.ts`),
  }))
}
