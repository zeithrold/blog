/* eslint-disable max-lines -- Keep suite-identity regressions beside the migration gate they protect. */
import type { SuiteDeclaration } from '~/tests/ci/suite-declarations'
import type { SuiteDeclarationIndex, SuiteIdentity, SuitePath } from '~/tests/ci/suite-identity'
import assert from 'node:assert/strict'
import { test as nodeTest } from 'node:test'
import { suiteDeclarations } from '~/tests/ci/suite-declarations'
import {
  caseKeyIssue,
  retainedSuiteIssues,
  retiredSuiteIssues,
  suiteDeclarationIndex,
} from '~/tests/ci/suite-identity'
import { componentMigrations } from '~/tests/contracts/component-migrations'
import { discoverBrowserCases, discoverDomCases } from '~/tests/contracts/discovery'
import { documentsCatalogContracts as baseline } from '~/tests/contracts/documents-catalog'
import { domMigrations } from '~/tests/contracts/dom-migrations'
import { historyServerProofs } from '~/tests/contracts/history-migrations'
import { historyRemainingServerProofs } from '~/tests/contracts/history-remaining-migrations'
import { documentsCatalogContracts } from '~/tests/contracts/registry'
import { surfaceMigrations } from '~/tests/contracts/surface-migrations'

const domRoot = 'tests/dom/'

function parts(key: string): { file: string, title: string } {
  const [file, title, extra] = key.split(' :: ')
  if (file === undefined || title === undefined || extra !== undefined) {
    throw new Error(`Invalid DOM migration case key: ${key}`)
  }
  return { file, title }
}

/**
 * A record names cases that were registered exactly. A templated or wildcard key
 * would match nothing and still read as a retirement, so it is refused here: the
 * gate may not be widened to accept a key that names no single case.
 */
function placeholder(title: string): boolean {
  return /[<>{}*?]|\$\(/.test(title)
}

function exactKeys(migration: Migration): string[] {
  return [
    ...migration.dom.map(successor => successor.case),
  ].flatMap((key) => {
    const { title } = parts(key)
    return placeholder(title)
      ? [
          `${migration.id} › ${key}: not an exact registered case`,
        ]
      : []
  })
}

/** The native layer a migration key belongs to, decided by the file it names. */
function layerOf(file: string): 'dom' | 'components' | 'e2e' {
  if (file.startsWith(domRoot)) {
    return 'dom'
  }
  if (file.startsWith('tests/components/')) {
    return 'components'
  }
  if (file.startsWith('tests/browser/')) {
    return 'e2e'
  }
  throw new Error(`DOM migration key names no known layer: ${file}`)
}

function planIssues(plan: readonly PlanEntry[]): string[] {
  const issues: string[] = []
  if (plan.length === 0) {
    return ['the jsdom layer must list at least one case']
  }
  const keys = plan.map(entry => JSON.stringify([
    entry.file,
    entry.describe ?? [],
    entry.title,
  ]))
  if (new Set(keys).size !== keys.length) {
    issues.push('a case listed twice cannot prove one result')
  }
  const foreign = plan.filter(entry => !entry.file.startsWith(domRoot) || !entry.file.endsWith('.test.tsx'))
  for (const entry of foreign) {
    issues.push(`DOM cases live in the jsdom layer, never a browser spec: ${entry.file}`)
  }
  return issues
}

type Migration = (typeof domMigrations)[number]
type PlanEntry = { file: string, title: string, describe?: readonly string[] }

const declaredSuites = suiteDeclarationIndex(
  [
    ...componentMigrations.flatMap(migration => migration.component),
    ...surfaceMigrations.flatMap(migration => migration.component),
    ...historyServerProofs.flatMap(proof => [
      proof.component,
      ...proof.integration,
    ].map(caseKey => ({ case: caseKey }))),
    ...historyRemainingServerProofs.flatMap(proof => [
      proof.component,
      ...proof.integration,
    ].map(caseKey => ({ case: caseKey }))),
  ],
  baseline.flatMap(contract => [
    ...contract.unit,
    ...contract.integration,
    ...contract.component,
    ...contract.e2e,
  ]),
  suiteDeclarations,
)

function successorIssues(migration: Migration, plan: readonly PlanEntry[]): string[] {
  return migration.dom.flatMap((successor) => {
    if (!parts(successor.case).file.startsWith(domRoot)) {
      return [
        `${migration.id} › ${successor.case}: not a jsdom case`,
      ]
    }
    const found = plan.filter(entry => entry.file === parts(successor.case).file
      && entry.title === parts(successor.case).title
      && JSON.stringify(entry.describe ?? []) === JSON.stringify(successor.describe ?? [])).length
    return found === 1
      ? []
      : [
          `${migration.id} › ${successor.case}: listed ${found} times`,
        ]
  })
}

function successorRecordIssues(
  migration: Migration,
  contracts: ReadonlySet<string>,
  seen: Set<string>,
): string[] {
  return migration.dom.flatMap((successor) => {
    const issues: string[] = []
    const key = JSON.stringify([
      successor.case,
      successor.describe ?? [],
    ])
    if (seen.has(key)) {
      issues.push(`${migration.id} › ${successor.case}: declared twice`)
    }
    seen.add(key)
    for (const id of successor.contracts ?? []) {
      if (!contracts.has(id)) {
        issues.push(`${migration.id} › ${successor.case}: cites an unknown contract ${id}`)
      }
    }
    return issues
  })
}

// A record exists to say where an old case went. Retiring one without naming a
// successor is the silent gap this ledger is meant to prevent.
function legacyRecordIssues(migration: Migration): string[] {
  if (migration.legacy.length === 0) {
    return [
      `${migration.id}: a migration record must name the old cases it succeeds`,
    ]
  }
  const retained = new Set(migration.retained.flatMap(group => group.cases))
  const orphaned = Array.from(retained).filter(key => !migration.legacy.includes(key))
  return [
    ...migration.legacy.flatMap((key) => {
      const issues: string[] = []
      if (placeholder(parts(key).title)) {
        issues.push(`${migration.id} › ${key}: not an exact registered case`)
      }
      if (migration.dom.length === 0) {
        issues.push(`${migration.id} › ${key}: retired with no DOM successor`)
      }
      if (!retained.has(key) && layerOf(parts(key).file) === 'dom') {
        issues.push(`${migration.id} › ${key}: a DOM case cannot be its own legacy case`)
      }
      return issues
    }),
    ...orphaned.map(key => `${migration.id} › ${key}: retained but not named in legacy`),
  ]
}

type PlanCase = SuiteIdentity

function browserCases(layer: 'components' | 'e2e'): PlanCase[] {
  const config = layer === 'components' ? 'playwright.components.config.ts' : 'playwright.config.ts'
  return discoverBrowserCases(config).map(entry => ({
    file: entry.file,
    title: entry.title,
    describe: Array.from(entry.describe ?? []),
    project: entry.projects[0] ?? '',
  }))
}

function retentionIssues(
  migration: Migration,
  plans: Record<'components' | 'e2e', readonly PlanCase[]>,
  declarations: typeof declaredSuites = declaredSuites,
): string[] {
  const retained = new Set(migration.retained.flatMap(group => group.cases))
  return migration.legacy.flatMap((key) => {
    const keyIssue = caseKeyIssue(key)
    if (keyIssue !== null) {
      return [
        `${migration.id} › ${key}: ${keyIssue}`,
      ]
    }
    const { file, title } = parts(key)
    const layer = layerOf(file)
    if (layer === 'dom') {
      return []
    }
    const plan = plans[layer]
    return ['chromium', 'webkit'].flatMap((project) => {
      const label = `${migration.id} › ${project} › ${key}`
      return retained.has(key)
        ? retainedSuiteIssues(plan, { file, title, project }, declarations, label)
        : retiredSuiteIssues(plan, { file, title, project }, declarations, label)
    })
  })
}

function retainedMigration(key: string): Migration {
  return {
    id: 'suite.identity',
    legacy: [key],
    dom: [],
    retained: [
      { cases: [key], reason: 'synthetic suite identity regression' },
    ],
  }
}

function declarationIndex(key: string, describe: SuitePath): SuiteDeclarationIndex {
  const { file } = parts(key)
  const declaration: SuiteDeclaration = {
    describe,
    source: 'declaration-site',
    file,
    line: 1,
    note: 'synthetic test declaration',
  }
  return suiteDeclarationIndex(
    [],
    [],
    new Map([
      [key, declaration],
    ]),
  )
}

function browserEntries(
  file: string,
  title: string,
  describe: SuitePath,
  projects: readonly string[] = ['chromium', 'webkit'],
): PlanCase[] {
  return projects.map(project => ({ file, title, describe, project }))
}

nodeTest('explicit suite declarations carry valid provenance', () => {
  assert.deepEqual(Array.from(declaredSuites.issues.entries()), [])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('an explicit top-level declaration matches only the top-level case', () => {
  const key = 'tests/browser/suite-identity.spec.ts :: a declared top-level case'
  const { file, title } = parts(key)
  const migration = retainedMigration(key)
  const declarations = declarationIndex(key, [])
  const topLevel = {
    components: [],
    e2e: browserEntries(file, title, []),
  }
  assert.deepEqual(retentionIssues(migration, topLevel, declarations), [])

  const nested = {
    components: [],
    e2e: browserEntries(file, title, ['nested']),
  }
  const issues = retentionIssues(migration, nested, declarations)
  assert.equal(issues.filter(issue => issue.includes('wrong suite')).length, 2)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('a declared nonempty suite path rejects the same case in another suite', () => {
  const key = 'tests/browser/suite-identity.spec.ts :: a nested case'
  const { file, title } = parts(key)
  const migration = retainedMigration(key)
  const declarations = declarationIndex(key, ['expected suite'])
  const plan = {
    components: [],
    e2e: browserEntries(file, title, ['wrong suite']),
  }
  const issues = retentionIssues(migration, plan, declarations)
  assert.equal(issues.filter(issue => issue.includes('wrong suite')).length, 2)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('one listing candidate cannot supply its own missing declaration', () => {
  const key = 'tests/browser/suite-identity.spec.ts :: an undeclared case'
  const { file, title } = parts(key)
  const migration = retainedMigration(key)
  const plan = {
    components: [],
    e2e: browserEntries(file, title, ['only candidate']),
  }
  const issues = retentionIssues(migration, plan, suiteDeclarationIndex([], [], new Map<string, unknown>()))
  assert.equal(issues.length, 2)
  assert.ok(issues.every(issue => issue.includes('no declared suite path')))
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

/*
 * A retirement removes the case, not the suite path it happened to sit in. The
 * key below is a real ledger entry whose record retains nothing, so any candidate
 * with its file and title is the old case still running — including one that
 * someone moved into another describe block.
 */
const retiredLookupKey = 'tests/components/specs/references-lookup.spec.ts :: failed and partial DOI lookups'
  + ' leave manual creation available'

function retiredMigration(key: string): Migration {
  return {
    id: 'suite.identity',
    legacy: [key],
    dom: [],
    retained: [],
  }
}

nodeTest('a retired case moved into another suite is still a surviving case', () => {
  const { file, title } = parts(retiredLookupKey)
  const issues = retentionIssues(
    retiredMigration(retiredLookupKey),
    {
      components: browserEntries(file, title, ['resurrected wrong suite']),
      e2e: [],
    },
    declarationIndex(retiredLookupKey, []),
  )
  assert.ok(issues.length > 0, 'a retired case must be absent from every suite path')
  assert.ok(
    issues.every(issue => issue.includes('retired case still listed')),
    `the reason must name a surviving case: ${issues.join(' | ')}`,
  )
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('a retired case that really stopped running is accepted', () => {
  const issues = retentionIssues(
    retiredMigration(retiredLookupKey),
    {
      components: [],
      e2e: [],
    },
    declarationIndex(retiredLookupKey, []),
  )
  assert.deepEqual(issues, [])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

/*
 * Two retained identities keep the title they were first registered under, even
 * though their native residual is now narrower than that title. The title is the
 * machine-readable link from the first-generation case to the component case and
 * on to the DOM successor, so narrowing it would silently break the chain. The
 * expected titles are literals here, not read back from the ledger, so the
 * regression fails if the ledger is edited to agree with a rename.
 */
const historicalIdentities = [
  {
    record: 'table.caption-metadata',
    file: 'tests/components/specs/editor-table-caption.spec.ts',
    title: 'each table has an independent caption below its viewport at 1440px',
  },
  {
    record: 'media.gallery-ui',
    file: 'tests/components/specs/media-gallery.spec.ts',
    title: 'gallery accepts multi-file drops, protects active uploads and filters media',
  },
] as const

function pushUnless(issues: string[], condition: boolean, message: string): void {
  if (!condition) {
    issues.push(message)
  }
}

function identityChainIssues(
  identity: (typeof historicalIdentities)[number],
  components: readonly PlanCase[],
  domPlan: readonly { file: string, title: string }[],
): string[] {
  const key = `${identity.file} :: ${identity.title}`
  const record = domMigrations.find(migration => migration.id === identity.record)
  if (record === undefined) {
    return [
      `${identity.record}: no DOM migration record`,
    ]
  }
  const retained = record.retained.flatMap(group => group.cases)
  const issues: string[] = []
  pushUnless(issues, components.some(entry => entry.file === identity.file
    && entry.title === identity.title), `${key}: not registered in the component plan`)
  pushUnless(issues, record.legacy.includes(key), `${identity.record} › ${key}: not the recorded previous generation`)
  pushUnless(issues, retained.includes(key), `${identity.record} › ${key}: not the retained native case`)
  pushUnless(issues, record.dom.length > 0, `${identity.record}: no DOM successor carries the migrated assertions`)
  for (const successor of record.dom) {
    const known = domPlan.some(entry => `${entry.file} :: ${entry.title}` === successor.case)
    pushUnless(issues, known, `${identity.record} › ${successor.case}: not a real jsdom case`)
  }
  return issues
}

nodeTest('a retained identity keeps its registered title across both generations', () => {
  const domPlan = discoverDomCases()
  const components = browserCases('components')
  assert.deepEqual(
    historicalIdentities.flatMap(identity => identityChainIssues(identity, components, domPlan)),
    [],
  )
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

/*
 * A case retired completely into jsdom still keeps its historical identity. The
 * first-generation record holds K as a component node, the second-generation
 * record owns K in `legacy` and names a real jsdom successor, and K must be gone
 * from the native plan. Deleting the identity instead of the execution is what
 * this pins: the expected key is a literal, never read back from the data.
 */
const retiredBoldIdentity = 'tests/components/specs/editor-formatting.spec.ts :: bold affects only the selected range'
  + ' and undo restores plain text'

nodeTest('a completely retired case keeps its identity and loses only its execution', () => {
  const { file, title } = parts(retiredBoldIdentity)
  const issues: string[] = []
  const historical = surfaceMigrations.some(migration =>
    migration.component.some(entry => entry.case === retiredBoldIdentity))
  if (!historical) {
    issues.push('the first-generation component node is missing')
  }
  const owner = domMigrations.find(migration => migration.legacy.includes(retiredBoldIdentity))
  if (owner === undefined) {
    issues.push('no DOM record owns the historical key')
  }
  else {
    if (owner.retained.flatMap(group => group.cases).includes(retiredBoldIdentity)) {
      issues.push('a completely retired case must not be retained')
    }
    const domPlan = discoverDomCases()
    if (owner.dom.length === 0) {
      issues.push('the record names no jsdom successor')
    }
    for (const successor of owner.dom) {
      if (!domPlan.some(entry => `${entry.file} :: ${entry.title}` === successor.case)) {
        issues.push(`${successor.case}: successor is not a real jsdom case`)
      }
    }
  }
  if (browserCases('components').some(entry => entry.file === file && entry.title === title)) {
    issues.push('the retired case is still registered in the component plan')
  }
  assert.deepEqual(issues, [])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('the retained publication E2E identity passes only with both projects', () => {
  const file = 'tests/browser/publication/publication-errors.spec.ts'
  const title = 'correcting a rejected draft clears its reasons and publishes the saved content'
  const key = `${file} :: ${title}`
  const migration = retainedMigration(key)
  const declarations = declarationIndex(key, [])
  const bothProjects = {
    components: [],
    e2e: browserEntries(file, title, []),
  }
  assert.deepEqual(retentionIssues(migration, bothProjects, declarations), [])

  const chromiumOnly = {
    components: [],
    e2e: browserEntries(file, title, [], ['chromium']),
  }
  const issues = retentionIssues(migration, chromiumOnly, declarations)
  assert.ok(issues.some(issue => issue.includes('webkit')))
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('a repeated file-title identity without a per-reference path is ambiguous', () => {
  const file = 'tests/browser/journeys/presentation.spec.ts'
  const title = 'accessibility scanner: late controls retain layout, focus and interaction contracts'
  const key = `${file} :: ${title}`
  const migration = retainedMigration(key)
  const suitePaths = [
    ['presentation journey 320px en'],
    ['presentation journey 320px zh'],
    ['presentation journey 390px en'],
    ['presentation journey 390px zh'],
    ['presentation journey 1440px en'],
    ['presentation journey 1440px zh'],
  ]
  const plan = {
    components: [],
    e2e: suitePaths.flatMap(describe => browserEntries(file, title, describe)),
  }
  const issues = retentionIssues(migration, plan, suiteDeclarationIndex([], [], new Map<string, unknown>()))
  assert.ok(issues.every(issue => issue.includes('ambiguous retained key')))
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('a file-only retained key is rejected as unnameable', () => {
  const key = 'tests/browser/history/history-interleaving.spec.ts'
  const issues = retentionIssues(retainedMigration(key), { components: [], e2e: [] })
  assert.equal(issues.length, 1)
  assert.equal(issues[0]?.includes('unnameable key'), true)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('unknown sources and incomplete declaration-site provenance remain gaps', () => {
  const key = 'tests/browser/suite-identity.spec.ts :: bad provenance'
  const missingLine: SuiteDeclaration = {
    describe: [],
    source: 'declaration-site',
    file: 'tests/browser/suite-identity.spec.ts',
  }
  const missingLineIndex = suiteDeclarationIndex(
    [],
    [],
    new Map([
      [key, missingLine],
    ]),
  )
  assert.equal(missingLineIndex.declarations.has(key), false)
  assert.equal(
    missingLineIndex.issues.get(key)?.[0]?.includes('requires a file and positive line number'),
    true,
  )

  const unknownSource = new Map<string, unknown>([
    [
      key,
      { describe: [], source: 'unknown' },
    ],
  ])
  const unknownSourceIndex = suiteDeclarationIndex([], [], unknownSource)
  assert.equal(unknownSourceIndex.declarations.has(key), false)
  assert.equal(unknownSourceIndex.issues.get(key)?.[0]?.includes('unknown source'), true)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

/*
 * The `dom` layer's own gate, beside the browser plan checks: it is native
 * discovery, so listing executes no case and starts no Worker.
 *
 * A jsdom case may only become proof through a migration record, and that record
 * has to name the old case it succeeds. These checks hold both sides: the new DOM
 * case is a real case of the jsdom plan, and an old case that stopped running is
 * only accepted when its record retired it deliberately.
 */
nodeTest('the DOM plan is a nonempty, unique, native listing of the jsdom layer', () => {
  assert.deepEqual(planIssues(discoverDomCases()), [])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('every DOM migration case is exactly one case of the jsdom plan', () => {
  const plan = discoverDomCases()
  const issues = domMigrations.flatMap(migration => successorIssues(migration, plan))
  assert.deepEqual(issues, [], 'DOM evidence names exact cases, never a file that exists')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('a DOM case replaces a recorded old case, never a silent gap', () => {
  const contracts = new Set(documentsCatalogContracts.map(contract => contract.id))
  const seen = new Set<string>()
  const issues = [
    ...domMigrations.flatMap(migration => exactKeys(migration)),
    ...domMigrations.flatMap(migration => successorRecordIssues(migration, contracts, seen)),
    ...domMigrations.flatMap(migration => legacyRecordIssues(migration)),
  ]
  assert.deepEqual(issues, [])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('a retained old case still runs and a retired one is gone', () => {
  const plans = {
    components: browserCases('components'),
    e2e: browserCases('e2e'),
  }
  const issues = domMigrations.flatMap(migration => retentionIssues(migration, plans))
  assert.deepEqual(issues, [], 'A missing old case is only accepted when the record retired it')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))
