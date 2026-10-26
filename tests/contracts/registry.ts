import type { RetirementRecord } from './retirement'
import type { BrowserReference, Layer, NodeReference, VerificationContract } from './types'
import { componentMigrations } from './component-migrations'
import { documentsCatalogContracts as baseline } from './documents-catalog'
import { domMigrations } from './dom-migrations'
import { historyServerProofs } from './history-migrations'
import { historyRemainingServerProofs } from './history-remaining-migrations'
import { classifyRetirements, contractEdgeIssue } from './retirement'

export function caseKey(reference: NodeReference): string {
  return `${reference.file} :: ${reference.title}`
}

export const retainedDomCaseKeys = new Set(domMigrations.flatMap(migration =>
  migration.retained.flatMap(group => group.cases)))

export function domReferenceKey(reference: NodeReference): string {
  return JSON.stringify([
    reference.file,
    reference.describe ?? [],
    reference.title,
  ])
}

/*
 * Retirement ownership, decided once for both generations of the ledger.
 *
 * `classifyRetirements` is the single rule: a case is only completely retired —
 * and only then may its native references leave a rule — when its owner names a
 * successor and nobody still keeps it. A split keeps every native reference and
 * gains the new proof alongside it. Any ownership contradiction is reported, and
 * `tests/ci/retirement.test.ts` fails the gate on it rather than letting one side
 * silently win.
 */
const ownership = classifyRetirements([
  ...componentMigrations.map((migration): RetirementRecord => ({
    id: migration.id,
    legacy: migration.legacy,
    retained: migration.retained.flatMap(group => group.cases),
    successors: migration.component.map(entry => ({
      key: entry.case,
      contracts: entry.contracts,
    })),
  })),
  ...domMigrations.map((migration): RetirementRecord => ({
    id: migration.id,
    legacy: migration.legacy,
    retained: migration.retained.flatMap(group => group.cases),
    successors: migration.dom.map(entry => ({
      key: entry.case,
      contracts: entry.contracts ?? [],
    })),
  })),
])

export const retirementOwnership = ownership

/** The rule edges each retiring record carries in its own successors. */
const successorContracts = new Map<string, ReadonlySet<string>>([
  ...componentMigrations.map((migration): [string, ReadonlySet<string>] => [
    migration.id,
    new Set(migration.component.flatMap(entry => entry.contracts)),
  ]),
  ...domMigrations.map((migration): [string, ReadonlySet<string>] => [
    migration.id,
    new Set(migration.dom.flatMap(entry => entry.contracts ?? [])),
  ]),
])

/**
 * Every rule that cited a component case before any trimming.
 *
 * Both sources count: a component case can be declared by its migration record
 * with `contracts`, or cited directly by a rule's baseline `component` list with
 * no earlier E2E parent. A rule that only ever cited the case directly is not
 * exempt from the continuity check, so it is indexed here too.
 */
function preTrimEdges(): Map<string, ReadonlySet<string>> {
  const index = new Map<string, Set<string>>()
  const add = (key: string, contractId: string): void => {
    const known = index.get(key) ?? new Set<string>()
    known.add(contractId)
    index.set(key, known)
  }
  for (const migration of componentMigrations) {
    for (const entry of migration.component) {
      for (const contractId of entry.contracts) {
        add(entry.case, contractId)
      }
    }
  }
  for (const contract of baseline) {
    for (const reference of contract.component) {
      add(caseKey(reference), contract.id)
    }
  }
  return index
}

const edges = preTrimEdges()
/** A reference may only leave when its retiring record carries that rule edge. */
const edgeIssues: string[] = []

/** Edges whose continuity could not be proved; each kept its native reference. */
export const retirementEdgeIssues: readonly string[] = edgeIssues

function carriesEdge(key: string, contractId: string): boolean {
  const issue = contractEdgeIssue({
    key,
    contractId,
    owner: ownership.owner,
    successorContracts,
  })
  if (issue === null) {
    return true
  }
  // The rule cited this case before trimming, so the edge is owed, not optional.
  if (edges.get(key)?.has(contractId) !== true) {
    return true
  }
  edgeIssues.push(issue)
  return false
}

export const retainedCaseKeys = new Set(componentMigrations.flatMap(migration =>
  migration.retained.flatMap(group => group.cases)))
export const retiredCaseKeys = new Set(componentMigrations.flatMap(migration =>
  migration.legacy.filter(key => !retainedCaseKeys.has(key))))

function caseReference(key: string): NodeReference {
  const [file, title, extra] = key.split(' :: ')
  if (file === undefined || title === undefined || extra !== undefined) {
    throw new Error(`Invalid case reference: ${key}`)
  }
  return { file, title }
}

function componentReference(key: string, describe: readonly string[] = []): BrowserReference {
  return { ...caseReference(key), describe, projects: ['chromium', 'webkit'] }
}

function componentReferences(): Map<string, BrowserReference[]> {
  const ids = new Set<string>(baseline.map(contract => contract.id))
  const references = new Map<string, BrowserReference[]>()
  for (const migration of componentMigrations) {
    for (const component of migration.component) {
      const reference = componentReference(component.case, component.describe)
      for (const id of component.contracts) {
        if (!ids.has(id)) {
          throw new Error(`Component migration cites an unknown contract: ${id}`)
        }
        const entries = references.get(id) ?? []
        if (!entries.some(entry => caseKey(entry) === caseKey(reference))) {
          entries.push(reference)
        }
        references.set(id, entries)
      }
    }
  }
  return references
}

const references = componentReferences()

// A jsdom case enters a rule the same way a component case does: only through a
// reviewed migration record, so the old case it succeeds stays on the ledger.
function domReferences(): Map<string, NodeReference[]> {
  const ids = new Set<string>(baseline.map(contract => contract.id))
  const byContract = new Map<string, NodeReference[]>()
  for (const migration of domMigrations) {
    for (const successor of migration.dom) {
      const reference: NodeReference = {
        ...caseReference(successor.case),
        describe: successor.describe ?? [],
      }
      for (const id of successor.contracts ?? []) {
        if (!ids.has(id)) {
          throw new Error(`DOM migration cites an unknown contract: ${id}`)
        }
        const entries = byContract.get(id) ?? []
        if (!entries.some(entry => domReferenceKey(entry) === domReferenceKey(reference))) {
          entries.push(reference)
        }
        byContract.set(id, entries)
      }
    }
  }
  return byContract
}

const domByContract = domReferences()

/** A rule is proved by the most specific layer that still carries it. */
type PrimaryInput = {
  readonly primary: Layer
  readonly component: readonly unknown[]
  readonly dom: readonly unknown[]
  readonly e2e: readonly unknown[]
}

/**
 * Where a rule's primary proof lives once older layers are retired.
 *
 * The chain is `e2e` → `component` → `dom`: a retirement may only move a rule to
 * the next layer that now proves it, never up and never to a layer with no
 * reference. A rule whose primary layer emptied without a successor keeps its
 * declared layer on purpose, so `assessContracts` still reports a missing primary
 * proof instead of accepting an empty contract. `unit` and `integration` never
 * move: those layers answer a different question.
 */
export function primaryProof(input: PrimaryInput): Layer {
  const chain: readonly Layer[] = [
    'e2e',
    'component',
    'dom',
  ]
  const counts: Partial<Record<Layer, readonly unknown[]>> = {
    component: input.component,
    dom: input.dom,
    e2e: input.e2e,
  }
  const own = counts[input.primary]
  if (own !== undefined && own.length > 0) {
    return input.primary
  }
  const position = chain.indexOf(input.primary)
  if (position === -1) {
    return input.primary
  }
  const successor = chain.slice(position + 1)
    .find(layer => (counts[layer]?.length ?? 0) > 0)
  return successor ?? input.primary
}

// Current proof, composed from the reviewed boundary rules and their explicit
// assertion migrations. Retained router/SSR/real-persistence cases stay E2E.
export const documentsCatalogContracts: VerificationContract[] = baseline.map((contract) => {
  const component = [
    ...contract.component,
    ...references.get(contract.id) ?? [],
  ].filter((reference) => {
    const key = caseKey(reference)
    if (!ownership.complete.has(key)) {
      return true
    }
    // A complete retirement leaves only when its owner carries this rule edge;
    // otherwise the reference stays so the native obligation cannot vanish.
    return !carriesEdge(key, contract.id)
  })
  const dom = domByContract.get(contract.id) ?? []
  const e2e = contract.e2e.filter(reference => !retiredCaseKeys.has(caseKey(reference)))
  const primary = primaryProof({
    primary: contract.primary,
    component,
    dom,
    e2e,
  })
  return { ...contract, primary, dom, component, e2e }
})

// Mocked HTTP acknowledgements prove client behavior, not stored server state.
// These exact Worker cases preserve the backend assertions retired from E2E.
const migratedServerProofs = [
  ...[
    ...historyServerProofs,
    ...historyRemainingServerProofs,
  ].flatMap(proof => proof.integration.map(key => ({
    ...caseReference(key),
    behavior: proof.proves.join('; '),
  }))),
  {
    file: 'tests/integration/asset-allocation.integration.ts',
    title: 'asset allocation stores one row and replays it for the same idempotency key',
    behavior: 'One allocation stores exactly one row; same-key replay returns it and changed-body reuse is refused.',
  },
  {
    file: 'tests/integration/publication-validation.integration.ts',
    title: 'built Worker: publishing an invalid envelope names every issue and leaves live untouched',
    behavior: 'Publishing invalid content returns the real 422 issue list without advancing version or public state.',
  },
]

export const migrationServerContracts: VerificationContract[] = migratedServerProofs.map((proof) => {
  const { behavior, ...reference } = proof
  return {
    id: `migrated-server.${reference.title.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    behavior,
    primary: 'integration',
    unit: [],
    integration: [reference],
    dom: [],
    component: [],
    e2e: [],
    dimensions: ['persistence'],
    rationale: 'Stored counters, head/live isolation and conflict guards need the real Worker, never a fixture.',
  }
})
