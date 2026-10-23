export type Evidence = {
  file: string
  project: string
  title: string
  caseTitle: string
  checkpoints: string[]
  status: string
  retry: number
  annotations: { type: string, description?: string }[]
}
type AssessedEvidence = Evidence & { platformLimitation: string | undefined, excluded: boolean }

const cdpOnly = [
  {
    file: 'editor/tables/table-drag',
    title: /^long press (row|column) handle reorders and stays usable$/u,
    reason: 'Chromium CDP drives physical touch; mouse coverage runs on all browsers.',
  },
  {
    file: 'editor/tables/table-drag',
    title: /^early touch movement and system cancellation leave content intact$/u,
    reason: 'Physical touch requires Chromium CDP.',
  },
  {
    file: 'editor/tables/table-drag-edges',
    title: /^touch column drag scrolls a wide table without releasing$/u,
    reason: 'Physical touch requires Chromium CDP.',
  },
  {
    file: 'references/reference-drawer-page',
    title: /^touch dragging sorts authors without dismissing the drawer$/u,
    reason: 'Physical touch dragging uses Chromium CDP.',
  },
]

function limitation(test: Evidence): string | undefined {
  if (test.project !== 'webkit' || test.status !== 'skipped') {
    return undefined
  }
  const match = cdpOnly.find(item => test.file === `tests/browser/${item.file}.spec.ts`
    && item.title.test(test.caseTitle)
    && test.annotations.some(annotation => annotation.type === 'skip' && annotation.description === item.reason))
  return match?.reason
}

export function assessEvidence(results: Evidence[], test: Evidence): AssessedEvidence {
  const platformLimitation = limitation(test)
  const counterpartPassed = platformLimitation !== undefined && results.some(other =>
    other.project === 'chromium' && other.file === test.file && other.caseTitle === test.caseTitle
    && other.status === 'passed' && other.retry === 0)
  return { ...test, platformLimitation, excluded: counterpartPassed }
}

export function fileEvidence(results: Evidence[], file: string, project: string): {
  file: string
  passed: boolean
  tests: AssessedEvidence[]
} {
  const tests = results.filter(test => test.file === file && test.project === project)
    .map(test => assessEvidence(results, test))
  const applicable = tests.filter(test => !test.excluded)
  const passed = applicable.length > 0 && applicable.every(test => test.status === 'passed' && test.retry === 0)
  return { file, passed, tests }
}
