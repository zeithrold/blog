import type { BrowserReference, NodeReference, VerificationContract } from './types'
import { componentMigrations } from './component-migrations'
import { documentsCatalogContracts as baseline } from './documents-catalog'
import { historyServerProofs } from './history-migrations'

export function caseKey(reference: NodeReference): string {
  return `${reference.file} :: ${reference.title}`
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

// Current proof, composed from the reviewed boundary rules and their explicit
// assertion migrations. Retained router/SSR/real-persistence cases stay E2E.
export const documentsCatalogContracts: VerificationContract[] = baseline.map((contract) => {
  const component = [
    ...contract.component,
    ...references.get(contract.id) ?? [],
  ]
  const e2e = contract.e2e.filter(reference => !retiredCaseKeys.has(caseKey(reference)))
  const primary = contract.primary === 'e2e' && e2e.length === 0 && component.length > 0
    ? 'component'
    : contract.primary
  return { ...contract, primary, component, e2e }
})

// Mocked HTTP acknowledgements prove client behavior, not stored server state.
// These exact Worker cases preserve the backend assertions retired from E2E.
const migratedServerProofs = [
  ...historyServerProofs.flatMap(proof => proof.integration.map(key => ({
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
    component: [],
    e2e: [],
    dimensions: ['persistence'],
    rationale: 'Stored counters, head/live isolation and conflict guards need the real Worker, never a fixture.',
  }
})
