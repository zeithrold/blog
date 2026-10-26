/*
 * One rule for "what counts as retired", shared by every gate that trims proof.
 *
 * A ledger record owns a set of legacy cases. Some of them are fully retired: the
 * same record names a successor case in a later layer, and nothing still runs
 * them. Others are split: the record still lists the case as retained because a
 * browser still proves part of it. Only a complete retirement may remove the old
 * case's references from a rule; a split must keep every native reference and
 * gain the new proof alongside it.
 *
 * The two generations of the ledger have different shapes, so a caller normalises
 * its records into `RetirementRecord` and reads the answer here. That is what
 * stops the registry and the component gate from each carrying their own subtly
 * different idea of retirement — the defect this module replaces.
 */

export type RetirementRecord = {
  readonly id: string
  /** Legacy case keys this record owns, exactly as registered. */
  readonly legacy: readonly string[]
  /** Owned cases this record (or its layer) still proves natively. */
  readonly retained: readonly string[]
  /**
   * The cases this record re-proves in a later layer, with the rule ids they
   * cite. Ownership decides what may be retired: only a record that owns a case
   * may retire it, and only while it still names a successor case at all. A
   * successor listed by another record never authorises this one.
   */
  readonly successors: readonly {
    readonly key: string
    readonly contracts: readonly string[]
  }[]
}

export type RetirementOwnership = {
  /** Cases retired by their owner with a successor, and retained by nobody. */
  readonly complete: ReadonlySet<string>
  /** Cases some record still proves natively; their native references stay. */
  readonly split: ReadonlySet<string>
  /** The single record that retired each complete case, when it is unique. */
  readonly owner: ReadonlyMap<string, string>
  /** Ownership contradictions and retirements that name no successor. */
  readonly issues: readonly string[]
}

/**
 * Whether the record that retired a case also carries the rule edge being cut.
 *
 * A rule's component reference may only leave when the record that retired that
 * case names, in its own successors, the rule whose reference is being removed.
 * Another record's successor list never covers this rule, and a rule proved in
 * another layer does not either: the edge has to travel with the retirement.
 * Returns the reason to refuse, or `null` when the edge is carried.
 */
export function contractEdgeIssue(input: {
  readonly key: string
  readonly contractId: string
  readonly owner: ReadonlyMap<string, string>
  readonly successorContracts: ReadonlyMap<string, ReadonlySet<string>>
}): string | null {
  const retiring = input.owner.get(input.key)
  if (retiring === undefined) {
    return `${input.contractId} › ${input.key}: no unique record owns its retirement`
  }
  const carried = input.successorContracts.get(retiring)
  if (carried === undefined || !carried.has(input.contractId)) {
    return `${input.contractId} › ${input.key}: ${retiring} retired it without carrying this rule`
  }
  return null
}

/** Ownership problems a single record can already expose on its own. */
function recordIssues(record: RetirementRecord): string[] {
  const owned = new Set(record.legacy)
  return record.retained
    .filter(key => !owned.has(key))
    .map(key => `${record.id} › ${key}: retained but not named in legacy`)
}

/**
 * Where each owned case stands, plus the retirements that name no successor.
 * A key with no successor is reported here and deliberately left out of
 * `retired`, so it can never authorise removing its native references.
 */
function collectStates(records: readonly RetirementRecord[]): {
  states: Map<string, { retired: string[], split: string[] }>
  issues: string[]
} {
  const states = new Map<string, { retired: string[], split: string[] }>()
  const issues: string[] = []
  for (const record of records) {
    issues.push(...recordIssues(record))
    const retained = new Set(record.retained)
    const hasSuccessor = record.successors.length > 0
    for (const key of record.legacy) {
      const entry = states.get(key) ?? { retired: [], split: [] }
      if (retained.has(key)) {
        entry.split.push(record.id)
      }
      else if (hasSuccessor) {
        entry.retired.push(record.id)
      }
      else {
        issues.push(`${record.id} › ${key}: retired without naming a successor`)
      }
      states.set(key, entry)
    }
  }
  return { states, issues }
}

/** Resolves each key: owned natively somewhere, retired once, or a conflict. */
function resolve(states: Map<string, { retired: string[], split: string[] }>): {
  complete: Set<string>
  split: Set<string>
  owner: Map<string, string>
  issues: string[]
} {
  const complete = new Set<string>()
  const split = new Set<string>()
  const owner = new Map<string, string>()
  const issues: string[] = []
  for (const [key, entry] of states) {
    if (entry.split.length > 0 && entry.retired.length > 0) {
      issues.push(
        `${key}: retained by ${entry.split.join(', ')} and retired by ${entry.retired.join(', ')}`,
      )
    }
    else if (entry.split.length > 0) {
      split.add(key)
    }
    else if (entry.retired.length > 1) {
      issues.push(`${key}: retired by more than one record (${entry.retired.join(', ')})`)
    }
    else if (entry.retired.length === 1) {
      complete.add(key)
      const [retiring] = entry.retired
      if (retiring !== undefined) {
        owner.set(key, retiring)
      }
    }
  }
  return {
    complete,
    split,
    owner,
    issues,
  }
}

export function classifyRetirements(records: readonly RetirementRecord[]): RetirementOwnership {
  const collected = collectStates(records)
  const resolved = resolve(collected.states)
  return {
    complete: resolved.complete,
    split: resolved.split,
    owner: resolved.owner,
    issues: [
      ...collected.issues,
      ...resolved.issues,
    ],
  }
}
