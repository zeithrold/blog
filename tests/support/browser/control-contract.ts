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
    evidence: evidence.map(file => `tests/browser/${file}.spec.ts`),
  }))
}
