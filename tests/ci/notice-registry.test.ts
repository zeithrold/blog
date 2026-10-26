import type {
  Browser,
  BrowserReference,
  CaseEvidence,
  Layer,
  LayerEvidence,
  NodeReference,
  VerificationContract,
} from '~/tests/contracts/types'
import assert from 'node:assert/strict'
import { test as nodeTest } from 'node:test'
import { assessContracts } from '~/tests/contracts/assess'
import { documentsCatalogContracts as baseline } from '~/tests/contracts/documents-catalog'
import { caseKey, documentsCatalogContracts, retiredCaseKeys } from '~/tests/contracts/registry'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

const runId = '00000000-0000-4000-8000-000000000042'
const source = {
  revision: 'notice-registry-regression',
  fingerprint: 'synthetic-assessment-input',
}
const layerOrder: readonly Layer[] = [
  'unit',
  'integration',
  'dom',
  'component',
  'e2e',
]
const browserLayers = ['component', 'e2e'] as const
type BrowserLayer = (typeof browserLayers)[number]

function contractById(id: string): VerificationContract {
  const contract = documentsCatalogContracts.find(candidate => candidate.id === id)
  if (contract === undefined) {
    throw new Error(`The composed contract ledger no longer contains ${id}`)
  }
  return contract
}

const noticeRule = contractById('documents.notice-accessibility')
const retiredDomNoticeRule = contractById('documents.restore-conflict-notices')

function referencesFor(contract: VerificationContract, layer: Layer): readonly NodeReference[] {
  switch (layer) {
    case 'unit':
      return contract.unit
    case 'integration':
      return contract.integration
    case 'dom':
      return contract.dom
    case 'component':
      return contract.component
    case 'e2e':
      return contract.e2e
  }
}

type CaseMutation = {
  contractId: string
  layer: Layer
  reference: NodeReference
  project?: Browser
  omit?: boolean
  status?: string
  retry?: number
  describe?: readonly string[]
}

type CaseContext = {
  contractId: string
  layer: Layer
  mutation: CaseMutation | undefined
}

function syntheticCase(
  reference: NodeReference,
  project: Browser | undefined,
  mutation: CaseMutation | undefined,
): CaseEvidence {
  const describe = mutation?.describe ?? reference.describe ?? []
  const evidence: CaseEvidence = {
    file: reference.file,
    title: reference.title,
    describe: [
      ...describe,
    ],
    status: mutation?.status ?? 'passed',
    retry: mutation?.retry ?? 0,
  }
  if (project !== undefined) {
    evidence.project = project
  }
  return evidence
}

function casesForReference(
  reference: NodeReference,
  project: Browser | undefined,
  context: CaseContext,
): CaseEvidence[] {
  const { contractId, layer, mutation } = context
  const targeted = mutation !== undefined
    && mutation.contractId === contractId
    && mutation.layer === layer
    && mutation.reference === reference
    && mutation.project === project
  if (targeted && mutation.omit === true) {
    return []
  }
  return [
    syntheticCase(reference, project, targeted ? mutation : undefined),
  ]
}

function browserCases(
  references: readonly BrowserReference[],
  context: CaseContext & { layer: BrowserLayer },
): CaseEvidence[] {
  return references.flatMap(reference => reference.projects.flatMap(project =>
    casesForReference(reference, project, context)))
}

function casesFor(
  contract: VerificationContract,
  layer: Layer,
  mutation: CaseMutation | undefined,
): CaseEvidence[] {
  const context = { contractId: contract.id, layer, mutation }
  switch (layer) {
    case 'unit':
      return contract.unit.flatMap(reference =>
        casesForReference(reference, undefined, context))
    case 'integration':
      return contract.integration.flatMap(reference =>
        casesForReference(reference, undefined, context))
    case 'dom':
      return contract.dom.flatMap(reference =>
        casesForReference(reference, undefined, context))
    case 'component':
      return browserCases(contract.component, { ...context, layer })
    case 'e2e':
      return browserCases(contract.e2e, { ...context, layer })
  }
}

/*
 * These are fresh synthetic reports, not captured run artifacts. The composed
 * ledger supplies only the required case identities; run/source metadata and
 * every execution outcome are made here so the real assessment sees independent
 * pass, fail, retry, skip, suite and missing-project inputs.
 */
function syntheticEvidence(
  contracts: readonly VerificationContract[],
  mutation?: CaseMutation,
): LayerEvidence[] {
  return layerOrder.flatMap((layer) => {
    const references = contracts.flatMap(contract => referencesFor(contract, layer))
    if (references.length === 0) {
      return []
    }
    const cases = contracts.flatMap(contract => casesFor(contract, layer, mutation))
    return [
      {
        schemaVersion: 1,
        layer,
        runId,
        source,
        complete: true,
        cases,
      },
    ]
  })
}

type BrowserTarget = {
  layer: BrowserLayer
  reference: BrowserReference
}

function firstRetainedBrowserCase(contract: VerificationContract): BrowserTarget {
  for (const layer of browserLayers) {
    const reference = contract[layer].find(candidate =>
      candidate.projects.includes('chromium') && candidate.projects.includes('webkit'))
    if (reference !== undefined) {
      return { layer, reference }
    }
  }
  throw new Error(`The composed rule ${contract.id} has no Chromium/WebKit browser case`)
}

function referenceIssue(
  contract: VerificationContract,
  target: BrowserTarget,
  project: Browser | undefined,
  reason: string,
): { contract: string, layer: Layer, reason: string } {
  const label = `${target.reference.file} › ${target.reference.title}${project === undefined ? '' : ` (${project})`}`
  return { contract: contract.id, layer: target.layer, reason: `${label}: ${reason}` }
}

function assertRejected(
  contract: VerificationContract,
  evidence: readonly unknown[],
  expectedIssues: readonly { contract: string, layer: Layer, reason: string }[],
): void {
  const result = assessContracts([contract], evidence, runId, source)
  equal(result.passed, false)
  deepEqual(result.issues, expectedIssues)
}

function registerTest(name: string, run: () => void): void {
  nodeTest(name, run).catch((error: unknown) =>
    assert.fail(error instanceof Error ? error.message : 'Test failed'))
}

registerTest('the notice rules and retired DOM successor come from the composed ledger', () => {
  equal(noticeRule.dom.length > 0, true)
  equal(browserLayers.some(layer => noticeRule[layer].length > 0), true)

  const original = baseline.find(contract => contract.id === retiredDomNoticeRule.id)
  if (original === undefined) {
    throw new Error(`The baseline ledger no longer contains ${retiredDomNoticeRule.id}`)
  }
  const retiredOriginalCases = original.e2e.filter(reference =>
    retiredCaseKeys.has(caseKey(reference)))
  equal(retiredOriginalCases.length > 0, true)
  equal(original.e2e.every(reference => retiredCaseKeys.has(caseKey(reference))), true)
  equal(retiredDomNoticeRule.e2e.some(reference =>
    retiredOriginalCases.some(retired => caseKey(reference) === caseKey(retired))), false)
  equal(retiredDomNoticeRule.dom.length > 0, true)
})

registerTest('DOM proof alone does not satisfy the composed rule that requires browser evidence', () => {
  // Disabled requirement: every browser execution report; the DOM report remains complete and passing.
  const domOnly = syntheticEvidence([noticeRule]).filter(report => report.layer === 'dom')
  const requiredWithoutDom = layerOrder.filter(layer =>
    layer !== 'dom' && referencesFor(noticeRule, layer).length > 0)
  const expectedIssues = requiredWithoutDom.map(layer => ({
    contract: noticeRule.id,
    layer,
    reason: 'Missing, stale or incomplete native execution report',
  }))
  assertRejected(noticeRule, domOnly, expectedIssues)
})

type BrowserCaseOverride = Pick<CaseMutation, 'omit' | 'status' | 'retry' | 'describe'>
type BrowserScenario = {
  name: string
  project: Browser
  reason: string
  change: (target: BrowserTarget) => BrowserCaseOverride
}

const browserScenarios: readonly BrowserScenario[] = [
  // Disabled requirement: WebKit for this exact retained case; its Chromium result remains present.
  {
    name: 'a Chromium result cannot stand in for the retained WebKit browser case',
    project: 'webkit',
    reason: 'no executed case in this prepared run',
    change: () => ({ omit: true }),
  },
  // Disabled requirement: the selected Chromium execution must pass natively.
  {
    name: 'a native browser failure is not counted as a present passing case',
    project: 'chromium',
    reason: 'the case did not pass without retry',
    change: () => ({ status: 'failed' }),
  },
  // Disabled requirement: the selected Chromium execution must pass on its first attempt.
  {
    name: 'a browser case that passes only after retry is not an un-retried proof',
    project: 'chromium',
    reason: 'the case did not pass without retry',
    change: () => ({ retry: 1 }),
  },
  // Disabled requirement: the selected Chromium case must have executed and passed.
  {
    name: 'a listed but skipped browser case is not treated as an execution',
    project: 'chromium',
    reason: 'the case did not pass without retry',
    change: () => ({ status: 'skipped' }),
  },
  // Disabled requirement: exact describe-path identity; file and title are unchanged.
  {
    name: 'the same file and title in a different suite does not satisfy the rule',
    project: 'chromium',
    reason: 'no executed case in this prepared run',
    change: target => ({
      describe: [
        ...target.reference.describe ?? [],
        'different suite',
      ],
    }),
  },
]

for (const scenario of browserScenarios) {
  registerTest(scenario.name, () => {
    const target = firstRetainedBrowserCase(noticeRule)
    const mutation: CaseMutation = {
      contractId: noticeRule.id,
      layer: target.layer,
      reference: target.reference,
      project: scenario.project,
      ...scenario.change(target),
    }
    const expectedIssues = [
      referenceIssue(noticeRule, target, scenario.project, scenario.reason),
    ]
    assertRejected(noticeRule, syntheticEvidence([noticeRule], mutation), expectedIssues)
  })
}

registerTest('removing the DOM successor fails after the old browser case was retired', () => {
  // Disabled requirement: the DOM successor. The ledger primary remains; its old E2E case is retired.
  const withoutDomSuccessor = { ...retiredDomNoticeRule, dom: [] }
  const evidenceWithoutDom = syntheticEvidence([retiredDomNoticeRule])
    .filter(report => report.layer !== 'dom')
  const expectedIssues = [
    {
      contract: retiredDomNoticeRule.id,
      layer: retiredDomNoticeRule.primary,
      reason: 'Primary proof layer has no references',
    },
  ]
  assertRejected(withoutDomSuccessor, evidenceWithoutDom, expectedIssues)
})

registerTest('the all-present control accepts every layer and case required by both ledger rules', () => {
  // Every reference, browser project, suite path, and first-attempt passing result comes from the all-present fixture.
  const contracts = [noticeRule, retiredDomNoticeRule]
  const result = assessContracts(contracts, syntheticEvidence(contracts), runId, source)
  equal(result.passed, true)
  deepEqual(result.issues, [])
})
