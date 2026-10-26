import type { SuiteDeclaration, SuiteDeclarationSource } from './suite-declarations'

export type SuitePath = readonly string[]

export type SuiteIdentity = {
  readonly file: string
  readonly title: string
  readonly describe: SuitePath
  readonly project: string
}

export type SuiteDeclarationIndex = {
  readonly declarations: ReadonlyMap<string, readonly SuiteDeclaration[]>
  readonly issues: ReadonlyMap<string, readonly string[]>
}

type MigrationDeclaration = { readonly case: string, readonly describe?: SuitePath }
type BaselineReference = {
  readonly file: string
  readonly title: string
  readonly describe?: SuitePath
}

type BrowserCaseReference = Pick<SuiteIdentity, 'file' | 'title' | 'project'>

function caseKey(file: string, title: string): string {
  return `${file} :: ${title}`
}

export function caseKeyIssue(key: string): string | null {
  const [file, title, extra] = key.split(' :: ')
  if (file === undefined || file.length === 0 || title === undefined || title.length === 0 || extra !== undefined) {
    return 'unnameable key: expected a file and exact case title'
  }
  return null
}

function validPath(value: unknown): value is SuitePath {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSuiteDeclarationSource(value: unknown): value is SuiteDeclarationSource {
  return value === 'first-generation' || value === 'baseline' || value === 'declaration-site'
}

function declarationIssue(value: unknown): string | null {
  if (!isRecord(value)) {
    return 'declaration is not an object'
  }
  if (!isSuiteDeclarationSource(value.source)) {
    return 'declaration has a missing or unknown source'
  }
  if (!validPath(value.describe)) {
    return 'declaration has an invalid suite path'
  }
  if (value.source === 'declaration-site'
    && (typeof value.file !== 'string'
      || value.file.length === 0
      || typeof value.line !== 'number'
      || !Number.isInteger(value.line)
      || value.line < 1)) {
    return 'declaration-site source requires a file and positive line number'
  }
  return null
}

function suiteDeclaration(value: unknown): SuiteDeclaration {
  if (!isRecord(value) || !isSuiteDeclarationSource(value.source) || !validPath(value.describe)) {
    throw new Error('Validated suite declaration is no longer valid')
  }
  return {
    describe: value.describe,
    source: value.source,
    ...(typeof value.file === 'string' ? { file: value.file } : {}),
    ...(typeof value.line === 'number' ? { line: value.line } : {}),
    ...(typeof value.note === 'string' ? { note: value.note } : {}),
  }
}

/**
 * Combines stable migration/baseline declarations with explicitly recorded
 * declaration-site paths. Reuse of a case through several rules adds one path.
 */
export function suiteDeclarationIndex(
  migrationDeclarations: readonly MigrationDeclaration[],
  baselineReferences: readonly BaselineReference[],
  explicitDeclarations: ReadonlyMap<string, unknown>,
): SuiteDeclarationIndex {
  const byKey = new Map<string, Map<string, SuiteDeclaration>>()
  const issues = new Map<string, string[]>()
  const addIssue = (key: string, issue: string): void => {
    const entries = issues.get(key) ?? []
    entries.push(issue)
    issues.set(key, entries)
  }
  const add = (key: string, declaration: SuiteDeclaration): void => {
    const paths = byKey.get(key) ?? new Map<string, SuiteDeclaration>()
    const path = [
      ...declaration.describe,
    ]
    paths.set(JSON.stringify(path), { ...declaration, describe: path })
    byKey.set(key, paths)
  }

  for (const declaration of migrationDeclarations) {
    add(declaration.case, {
      describe: declaration.describe ?? [],
      source: 'first-generation',
    })
  }
  for (const reference of baselineReferences) {
    add(caseKey(reference.file, reference.title), {
      describe: reference.describe ?? [],
      source: 'baseline',
    })
  }
  for (const [key, rawDeclaration] of explicitDeclarations) {
    const keyIssue = caseKeyIssue(key)
    if (keyIssue !== null) {
      addIssue(key, keyIssue)
      continue
    }
    const issue = declarationIssue(rawDeclaration)
    if (issue !== null) {
      addIssue(key, issue)
      continue
    }
    add(key, suiteDeclaration(rawDeclaration))
  }

  for (const key of issues.keys()) {
    byKey.delete(key)
  }
  const declarations = new Map<string, readonly SuiteDeclaration[]>()
  for (const [key, paths] of byKey) {
    declarations.set(key, Array.from(paths.values()))
  }
  return {
    declarations,
    issues,
  }
}

export function exactSuiteCount(
  plan: readonly SuiteIdentity[],
  expected: SuiteIdentity,
): number {
  return plan.filter(entry => entry.file === expected.file
    && entry.title === expected.title
    && entry.project === expected.project
    && sameSuitePath(entry.describe, expected.describe)).length
}

function sameSuitePath(left: SuitePath, right: SuitePath): boolean {
  return left.length === right.length && left.every((part, index) => part === right[index])
}

function caseCandidates(
  plan: readonly SuiteIdentity[],
  reference: BrowserCaseReference,
): SuiteIdentity[] {
  return plan.filter(entry => entry.file === reference.file
    && entry.title === reference.title
    && entry.project === reference.project)
}

function missingRetainedDeclaration(
  plan: readonly SuiteIdentity[],
  reference: BrowserCaseReference,
  label: string,
): string[] {
  const candidatePaths = new Set(caseCandidates(plan, reference)
    .map(entry => JSON.stringify(entry.describe)))
  const message = candidatePaths.size > 1
    ? `${label}: ambiguous retained key has ${candidatePaths.size} suite paths but no per-reference declaration`
    : `${label}: retained case has no declared suite path`
  return [message]
}

function declaredRetainedSuiteIssues(
  plan: readonly SuiteIdentity[],
  reference: BrowserCaseReference,
  declarations: readonly SuiteDeclaration[],
  label: string,
): string[] {
  const candidatePaths = new Set(caseCandidates(plan, reference)
    .map(entry => JSON.stringify(entry.describe)))
  if (candidatePaths.size > 1) {
    const message = `${label}: ambiguous retained key has ${candidatePaths.size} suite paths`
    return [message]
  }
  if (declarations.length > 1) {
    const message = `${label}: ambiguous retained key has ${declarations.length} declared suite paths`
    return [message]
  }
  const [declaration] = declarations
  if (declaration === undefined) {
    return [
      `${label}: retained case has no declared suite path`,
    ]
  }
  const found = exactSuiteCount(plan, {
    ...reference,
    describe: declaration.describe,
  })
  const suitePath = JSON.stringify(declaration.describe)
  const message = `${label}: retained case listed ${found} times for its declared suite path ${suitePath}`
  const issues: string[] = found === 1 ? [] : [message]
  for (const entry of caseCandidates(plan, reference)) {
    if (!sameSuitePath(entry.describe, declaration.describe)) {
      issues.push(
        `${label}: wrong suite ${JSON.stringify(entry.describe)}; expected ${JSON.stringify(declaration.describe)}`,
      )
    }
  }
  return issues
}

export function retainedSuiteIssues(
  plan: readonly SuiteIdentity[],
  reference: BrowserCaseReference,
  index: SuiteDeclarationIndex,
  label: string,
): string[] {
  const key = caseKey(reference.file, reference.title)
  const keyIssue = caseKeyIssue(key)
  if (keyIssue !== null) {
    return [
      `${label}: ${keyIssue}`,
    ]
  }
  const declarationIssues = index.issues.get(key) ?? []
  if (declarationIssues.length > 0) {
    return declarationIssues.map(issue => `${label}: ${issue}`)
  }
  const declarations = index.declarations.get(key)
  if (declarations === undefined || declarations.length === 0) {
    return missingRetainedDeclaration(plan, reference, label)
  }
  return declaredRetainedSuiteIssues(plan, reference, declarations, label)
}

export function retiredSuiteIssues(
  plan: readonly SuiteIdentity[],
  reference: BrowserCaseReference,
  index: SuiteDeclarationIndex,
  label: string,
): string[] {
  const key = caseKey(reference.file, reference.title)
  const keyIssue = caseKeyIssue(key)
  if (keyIssue !== null) {
    return [
      `${label}: ${keyIssue}`,
    ]
  }
  const declarationIssues = index.issues.get(key) ?? []
  if (declarationIssues.length > 0) {
    return declarationIssues.map(issue => `${label}: ${issue}`)
  }
  const declarations = index.declarations.get(key)
  if (declarations !== undefined && declarations.length > 1) {
    const message = `${label}: ambiguous retired key has ${declarations.length} declared suite paths`
    return [message]
  }
  // A retirement removes the case, not merely the suite path it sat in. Any
  // surviving candidate for this file, title and project is the old case still
  // running, so a case that moved suites is reported rather than read as gone:
  // the declared path only describes where it used to be, never what has to be
  // empty. Absence is therefore judged over every candidate, not one suite.
  const candidates = caseCandidates(plan, reference)
  if (candidates.length === 0) {
    return []
  }
  const paths = new Set(candidates.map(entry => JSON.stringify(entry.describe)))
  const [declaration] = declarations ?? []
  const expected = declaration === undefined
    ? ''
    : `; declared ${JSON.stringify(declaration.describe)}`
  return [
    `${label}: retired case still listed ${candidates.length} times across ${paths.size} suite path(s)${expected}`,
  ]
}
