import type { ControlAccountability } from '~/tests/contracts/control-map'
import type { VerificationContract } from '~/tests/contracts/types'
import type { ControlContract } from '~/tests/support/browser/control-contract'
import assert from 'node:assert/strict'
import { test as nodeTest } from 'node:test'
import { assessControlMap } from '~/tests/contracts/accountability'
import { assessContracts } from '~/tests/contracts/assess'
import { retirementEdgeIssues, retirementOwnership } from '~/tests/contracts/registry'
import { classifyRetirements, contractEdgeIssue } from '~/tests/contracts/retirement'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

/*
 * The retirement rule itself, in both directions.
 *
 * `classifyRetirements` is the one place that decides what "retired" means, so
 * these cases pin the shapes that used to be decided twice and wrongly: a split
 * case that keeps its native references, a complete retirement that does not, a
 * retirement that names no successor, and two records disagreeing about one case.
 * The last group pins the accountability consequence: a rule proved only in jsdom
 * is UI wiring proof, while a node-only rule never is.
 */

type LedgerRecord = Parameters<typeof classifyRetirements>[0][number]
type Contract = VerificationContract
type RuleId = ControlAccountability['contracts'][number]

const source = { revision: 'revision', fingerprint: 'fingerprint' }
const runId = crypto.randomUUID()
const legacyKey = 'tests/components/specs/rule.spec.ts :: case'
const domFile = 'tests/dom/rule.test.tsx'
const ruleId: RuleId = 'documents.list-query'

function caseTest(name: string, body: () => void): void {
  nodeTest(name, body).catch((error: unknown) => {
    assert.fail(error instanceof Error ? error.message : 'Test failed')
  })
}

function record(overrides: Partial<LedgerRecord>): LedgerRecord {
  return {
    id: 'rule.one',
    legacy: [legacyKey],
    retained: [],
    successors: [
      {
        key: domFile,
        contracts: [],
      },
    ],
    ...overrides,
  }
}

function report(layer: 'dom' | 'component'): Record<string, unknown> {
  return {
    schemaVersion: 1,
    layer,
    runId,
    source,
    complete: true,
    cases: [
      {
        file: layer === 'dom' ? domFile : 'tests/components/specs/rule.spec.ts',
        title: 'case',
        describe: [],
        status: 'passed',
        retry: 0,
      },
    ],
  }
}

/** `passed/issue-count`, so a case asserts one value instead of walking details. */
function verdict(of: Contract, reports: readonly unknown[]): string {
  const assessed = assessContracts([of], reports, runId, source)
  return `${assessed.passed ? 'pass' : 'fail'}/${assessed.issues.length}`
}

function contract(parts: Partial<Contract>): Contract {
  return {
    id: ruleId,
    behavior: 'the rule under test',
    primary: 'component',
    unit: [],
    integration: [],
    dom: [],
    component: [],
    e2e: [],
    dimensions: [],
    rationale: 'retirement semantics',
    ...parts,
  }
}

const componentRef = {
  file: 'tests/components/specs/rule.spec.ts',
  title: 'case',
  describe: [],
  projects: ['chromium', 'webkit'] as const,
}
const domRef = {
  file: domFile,
  title: 'case',
  describe: [],
}

caseTest('a split case keeps its native obligation', () => {
  const ownership = classifyRetirements([
    record({
      retained: [legacyKey],
    }),
  ])
  deepEqual(Array.from(ownership.split), [legacyKey])
  deepEqual(Array.from(ownership.complete), [])
  const split = contract({
    component: [componentRef],
    dom: [domRef],
    primary: 'dom',
  })
  // Its native layer still owes a report; only the DOM report is supplied here.
  equal(verdict(split, [
    report('dom'),
  ]), 'fail/1')
})

caseTest('a complete retirement leaves no native obligation', () => {
  const ownership = classifyRetirements([
    record({}),
  ])
  deepEqual(Array.from(ownership.complete), [legacyKey])
  deepEqual(Array.from(ownership.split), [])
  const retired = contract({
    dom: [domRef],
    primary: 'dom',
  })
  equal(verdict(retired, [
    report('dom'),
  ]), 'pass/0')
})

caseTest('a retirement that names no successor is a gap, not a retirement', () => {
  const ownership = classifyRetirements([
    record({
      successors: [],
    }),
  ])
  deepEqual(ownership.issues, [
    'rule.one › tests/components/specs/rule.spec.ts :: case: retired without naming a successor',
  ])
  deepEqual(Array.from(ownership.complete), [])
})

caseTest('an unrelated record successor is not authorization', () => {
  const ownership = classifyRetirements([
    record({ id: 'rule.one', successors: [] }),
    record({ id: 'rule.two', legacy: [], retained: [] }),
  ])
  deepEqual(Array.from(ownership.complete), [])
  deepEqual(ownership.issues, [
    'rule.one › tests/components/specs/rule.spec.ts :: case: retired without naming a successor',
  ])
})

caseTest('one record retaining what another retired is a conflict, never silent', () => {
  const ownership = classifyRetirements([
    record({ id: 'rule.one' }),
    record({ id: 'rule.two', retained: [legacyKey] }),
  ])
  deepEqual(Array.from(ownership.complete), [])
  deepEqual(Array.from(ownership.split), [])
  deepEqual(ownership.issues, [
    'tests/components/specs/rule.spec.ts :: case: retained by rule.two and retired by rule.one',
  ])
})

caseTest('the live ledger classifies without any ownership issue', () => {
  deepEqual(Array.from(retirementOwnership.issues), [])
})

const domOnly = contract({
  dom: [domRef],
  primary: 'dom',
})
const nodeOnly = contract({
  unit: [domRef],
  primary: 'unit',
})
const searchControl: ControlContract = {
  id: 'documents.search',
  surface: 'documents',
  locator: 'search',
  widths: [1440],
  states: ['ready'],
  behavior: 'the control under test',
  evidence: [],
}

function mapped(): ControlAccountability {
  return {
    id: searchControl.id,
    surface: 'documents',
    locator: 'search',
    contracts: [ruleId],
    asserted: true,
    retainedBy: [],
    note: 'a synthetic row for the wiring rule',
  }
}

caseTest('a rule proved only in jsdom is UI wiring proof', () => {
  deepEqual(assessControlMap([searchControl], [
    mapped(),
  ], [domOnly]), [])
})

caseTest('a node-only rule is never UI wiring proof', () => {
  deepEqual(assessControlMap([searchControl], [
    mapped(),
  ], [nodeOnly]), ['Control has no UI wiring proof: documents.search'])
})

/*
 * Rule-edge continuity: the record that retires a case must carry, in its own
 * successors, the rule whose reference is being cut. These are the ways it can
 * fail and the ways it holds.
 */

function successors(byRecord: Record<string, readonly string[]>): Map<string, ReadonlySet<string>> {
  return new Map(Object.entries(byRecord).map(([id, contracts]) => [
    id,
    new Set(contracts),
  ]))
}

const retireOwner = new Map([
  [legacyKey, 'documents-catalog-dom'],
])

/** The exact reason the ledger reports when a retiring record carries no edge. */
function missingEdge(contractId: string): string {
  return `${contractId} › ${legacyKey}: documents-catalog-dom retired it without carrying this rule`
}

caseTest('an owner whose successors carry no rule edge refuses the cut', () => {
  const reasoned = contractEdgeIssue({
    key: legacyKey,
    contractId: 'documents.list-query',
    owner: retireOwner,
    successorContracts: successors({ 'documents-catalog-dom': [] }),
  })
  equal(reasoned, missingEdge('documents.list-query'))
})

caseTest('another record carrying the rule does not cover the owner', () => {
  equal(contractEdgeIssue({
    key: legacyKey,
    contractId: 'documents.list-query',
    owner: retireOwner,
    successorContracts: successors({
      'documents-catalog-dom': [],
      'some-other-record': ['documents.list-query'],
    }),
  }), missingEdge('documents.list-query'))
})

caseTest('an owner carrying one rule does not cover the other', () => {
  const carried = successors({ 'documents-catalog-dom': ['documents.list-query'] })
  equal(contractEdgeIssue({
    key: legacyKey,
    contractId: 'documents.list-query',
    owner: retireOwner,
    successorContracts: carried,
  }), null)
  equal(contractEdgeIssue({
    key: legacyKey,
    contractId: 'documents.page-rendering',
    owner: retireOwner,
    successorContracts: carried,
  }), missingEdge('documents.page-rendering'))
})

caseTest('a baseline-only component reference is carried the same way', () => {
  equal(contractEdgeIssue({
    key: legacyKey,
    contractId: 'catalog.search-ui',
    owner: retireOwner,
    successorContracts: successors({ 'documents-catalog-dom': ['catalog.search-ui'] }),
  }), null)
})

caseTest('several successors of one owner can carry several rules together', () => {
  const carried = successors({ 'documents-catalog-dom': ['documents.list-query', 'documents.page-rendering'] })
  equal(contractEdgeIssue({
    key: legacyKey,
    contractId: 'documents.list-query',
    owner: retireOwner,
    successorContracts: carried,
  }), null)
  equal(contractEdgeIssue({
    key: legacyKey,
    contractId: 'documents.page-rendering',
    owner: retireOwner,
    successorContracts: carried,
  }), null)
})

caseTest('an unowned retirement closes the cut instead of opening it', () => {
  equal(contractEdgeIssue({
    key: legacyKey,
    contractId: 'documents.list-query',
    owner: new Map(),
    successorContracts: successors({ 'documents-catalog-dom': ['documents.list-query'] }),
  }), 'documents.list-query › tests/components/specs/rule.spec.ts :: case: no unique record owns its retirement')
})

caseTest('the live ledger cuts no edge its retiring record does not carry', () => {
  deepEqual(Array.from(retirementEdgeIssues), [])
})
