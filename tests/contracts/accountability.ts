import type { ControlAccountability } from './control-map'
import type { VerificationContract } from './types'
import type { ControlContract } from '~/tests/support/browser/control-contract'

export function assessControlMap(
  controls: readonly ControlContract[],
  mapping: readonly ControlAccountability[],
  contracts: readonly VerificationContract[],
): string[] {
  const expected = new Set(controls.map(control => control.id))
  const declared = new Set(mapping.map(entry => entry.id))
  const rules = new Map(contracts.map(contract => [contract.id, contract]))
  const issues: string[] = []
  if (declared.size !== mapping.length) {
    issues.push('Control mapping contains duplicate IDs')
  }
  for (const id of expected) {
    if (!declared.has(id)) {
      issues.push(`Unmapped migrated control: ${id}`)
    }
  }
  for (const entry of mapping) {
    if (!expected.has(entry.id)) {
      issues.push(`Control mapping contains an unknown ID: ${entry.id}`)
    }
    if (!entry.asserted || entry.contracts.length === 0) {
      issues.push(`Control still has an explicit coverage gap: ${entry.id}`)
    }
    const references = entry.contracts.map(id => rules.get(id))
    if (references.includes(undefined)) {
      issues.push(`Control cites an unknown rule: ${entry.id}`)
    }
    if (!references.some(rule => rule !== undefined
      && rule.dom.length + rule.component.length + rule.e2e.length > 0)) {
      issues.push(`Control has no UI wiring proof: ${entry.id}`)
    }
  }
  return issues
}
