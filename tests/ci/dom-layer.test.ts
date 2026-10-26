import assert from 'node:assert/strict'
import { test as nodeTest } from 'node:test'
import { discoverBrowserCases, discoverDomCases } from '~/tests/contracts/discovery'
import { domMigrations } from '~/tests/contracts/dom-migrations'
import { documentsCatalogContracts } from '~/tests/contracts/registry'

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

function browserCounts(layer: 'components' | 'e2e'): Map<string, number> {
  const config = layer === 'components' ? 'playwright.components.config.ts' : 'playwright.config.ts'
  const counts = new Map<string, number>()
  for (const entry of discoverBrowserCases(config)) {
    for (const project of entry.projects) {
      const key = `${entry.file} :: ${entry.title} :: ${project}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

function retentionIssues(
  migration: Migration,
  counts: Record<'components' | 'e2e', Map<string, number>>,
): string[] {
  const retained = new Set(migration.retained.flatMap(group => group.cases))
  return migration.legacy.flatMap((key) => {
    const { file, title } = parts(key)
    const layer = layerOf(file)
    if (layer === 'dom') {
      return []
    }
    const plan = counts[layer]
    return ['chromium', 'webkit'].flatMap((project) => {
      const found = plan.get(`${file} :: ${title} :: ${project}`) ?? 0
      const label = `${migration.id} › ${project} › ${key}`
      if (retained.has(key)) {
        return found === 1
          ? []
          : [
              `${label}: retained case listed ${found} times`,
            ]
      }
      return found === 0
        ? []
        : [
            `${label}: retired case still listed ${found} times`,
          ]
    })
  })
}

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
  const counts = {
    components: browserCounts('components'),
    e2e: browserCounts('e2e'),
  }
  const issues = domMigrations.flatMap(migration => retentionIssues(migration, counts))
  assert.deepEqual(issues, [], 'A missing old case is only accepted when the record retired it')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))
