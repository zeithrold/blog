import type { TestEvent } from 'node:test/reporters'
import type { CaseEvidence, LayerEvidence } from '~/tests/contracts/types'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { z } from 'zod'
import { currentRun, verificationRoot } from './paths.ts'
import { sourceIdentity } from './source.ts'

type FinishedEvent = Extract<TestEvent, { type: 'test:pass' | 'test:fail' }>

function status(event: FinishedEvent): string {
  if (event.data.skip !== undefined && event.data.skip !== false) {
    return 'skipped'
  }
  if (event.data.todo !== undefined && event.data.todo !== false) {
    return 'todo'
  }
  return event.type === 'test:pass' ? 'passed' : 'failed'
}

/*
 * Node names a case by title and depth only; the events never repeat the parent
 * path. Track the open title per depth in the native hierarchical event stream,
 * so a finished case carries its
 * native ancestry instead of an empty path that would let a nested case answer
 * for a top-level one. Declaration files are not execution roots: an imported
 * helper can declare a child of a test from a different file.
 */
class OpenTitles {
  private readonly open: string[] = []

  started(name: string, nesting: number): void {
    this.open.length = nesting
    this.open.push(name)
  }

  path(nesting: number): string[] | null {
    const parents = Array.from(this.open.slice(0, nesting))
    return parents.length === nesting && parents.every(title => typeof title === 'string') ? parents : null
  }
}

function finishedCase(event: TestEvent, titles: OpenTitles): CaseEvidence | null {
  if (event.type !== 'test:pass' && event.type !== 'test:fail') {
    return null
  }
  const data = event.data
  if (data.details.type === 'suite' || data.file === undefined) {
    return null
  }
  // A test file without tests is reported as one passing case named after the
  // file itself. That is a file outcome, not an executed case, so it must not
  // stand in as evidence that something ran.
  if (data.name === data.file) {
    return null
  }
  const describe = titles.path(data.nesting)
  return {
    file: path.relative(process.cwd(), data.file),
    title: data.name,
    describe: describe ?? [],
    status: describe === null ? 'unresolved-ancestry' : status(event),
    retry: 0,
  }
}

function opened(event: TestEvent, titles: OpenTitles): void {
  if (event.type === 'test:start' && event.data.file !== undefined) {
    titles.started(event.data.name, event.data.nesting)
  }
}

function summarySuccess(event: TestEvent): boolean | null {
  return event.type === 'test:summary' && event.data.file === undefined ? event.data.success : null
}

function unsuccessful(event: TestEvent): boolean {
  return (event.type === 'test:pass' || event.type === 'test:fail') && status(event) !== 'passed'
}

// A native node:test reporter, not a runner: test scheduling and exit status stay
// with Node. Record exact executed cases so a file name alone cannot prove a contract.
export default async function* report(source: AsyncIterable<TestEvent>): AsyncGenerator<string> {
  const layer = z.enum(['unit', 'integration']).parse(process.env.BLOG_TEST_LAYER)
  const run = currentRun()
  const identity = sourceIdentity()
  const titles = new OpenTitles()
  const cases: CaseEvidence[] = []
  let succeeded = false
  let allPassed = true
  for await (const event of source) {
    opened(event, titles)
    succeeded = summarySuccess(event) ?? succeeded
    if (unsuccessful(event)) {
      allPassed = false
    }
    const result = finishedCase(event, titles)
    if (result !== null) {
      cases.push(result)
    }
  }
  // A native run proves this layer only when it recorded cases and none of them
  // failed, skipped or stayed todo: a skipped subtest could otherwise hide inside
  // the parent case a contract cites.
  const evidence: LayerEvidence = {
    schemaVersion: 1,
    layer,
    runId: run?.id ?? null,
    source: identity,
    complete: succeeded && allPassed && cases.length > 0 && cases.every(entry => entry.status === 'passed'),
    cases,
  }
  await mkdir(verificationRoot, { recursive: true })
  // One file per invocation: a later run in the same prepared run must not
  // overwrite the evidence an earlier one produced.
  await writeFile(
    path.join(verificationRoot, `${layer}-${randomUUID()}.json`),
    JSON.stringify(evidence, null, 2),
  )
  yield ''
}
