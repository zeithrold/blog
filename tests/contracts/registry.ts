import type { BrowserReference, NodeReference, VerificationContract } from './types'
import { componentMigrations } from './component-migrations'
import { documentsCatalogContracts as baseline } from './documents-catalog'

export function caseKey(reference: NodeReference): string {
  return `${reference.file} :: ${reference.title}`
}

export const retainedCaseKeys = new Set(componentMigrations.flatMap(migration =>
  migration.retained.flatMap(group => group.cases)))
export const retiredCaseKeys = new Set(componentMigrations.flatMap(migration =>
  migration.legacy.filter(key => !retainedCaseKeys.has(key))))

function componentReference(key: string, describe: readonly string[] = []): BrowserReference {
  const [file, title, extra] = key.split(' :: ')
  if (file === undefined || title === undefined || extra !== undefined) {
    throw new Error(`Invalid component case reference: ${key}`)
  }
  return { file, title, describe, projects: ['chromium', 'webkit'] }
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
