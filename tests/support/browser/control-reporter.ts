import type { FullConfig } from '@playwright/test'
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import type { Evidence } from './control-evidence'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { assessEvidence, fileEvidence } from './control-evidence'
import { controlInventory } from './control-inventory'

export default class ControlReporter implements Reporter {
  private readonly results: Evidence[] = []
  private output = ''
  private root = ''
  private revision = ''
  private fingerprint = ''
  private worktree = ''

  onBegin(config: FullConfig): void {
    this.root = process.cwd()
    this.output = path.dirname(config.projects[0]?.outputDir ?? config.rootDir)
    this.revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    this.fingerprint = sourceFingerprint()
    this.worktree = execFileSync('git', ['status', '--short'], { encoding: 'utf8' })
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const steps = result.steps.filter(step => step.category === 'test.step').map(step => step.title)
    this.results.push({
      file: path.relative(this.root, test.location.file),
      project: test.parent.project()?.name ?? '',
      title: test.titlePath().join(' › '),
      caseTitle: test.title,
      checkpoints: steps.length > 0 ? steps : [test.title],
      status: result.status,
      retry: result.retry,
      annotations: test.annotations,
    })
  }

  async onEnd(result: FullResult): Promise<{ status: FullResult['status'] }> {
    const contracts = controlInventory.map(control => ({
      ...control,
      browsers: ['chromium', 'webkit'].map((project) => {
        const files = control.evidence.map(file => fileEvidence(this.results, file, project))
        return { project, covered: files.every(file => file.passed), files }
      }),
    }))
    const missing = contracts.filter(control => control.browsers.some(browser => !browser.covered))
    const skippedTests = this.results.filter(test => test.status === 'skipped')
      .map(test => assessEvidence(this.results, test))
    const unexplainedSkips = skippedTests.filter(test => !test.excluded)
    const files = Array.from(new Set(controlInventory.flatMap(control => control.evidence))).sort()
    for (const file of files) {
      await readFile(path.join(this.root, file))
    }
    const report = {
      revision: this.revision,
      sourceFingerprint: this.fingerprint,
      worktree: this.worktree,
      status: result.status,
      complete: missing.length === 0 && unexplainedSkips.length === 0,
      totalContracts: contracts.length,
      coveredContracts: contracts.length - missing.length,
      missing: missing.map(control => control.id),
      contracts,
      skippedTests,
    }
    await mkdir(this.output, { recursive: true })
    const functional = this.results.some(test => ['chromium', 'webkit'].includes(test.project))
    const filename = functional ? 'control-coverage.json' : 'control-coverage-performance.json'
    await writeFile(path.join(this.output, filename), JSON.stringify(report, null, 2))
    if (functional && process.env.BLOG_CONTROL_COVERAGE === '1' && !report.complete) {
      const counts = `${missing.length}/${contracts.length} contracts, ${unexplainedSkips.length} unexplained skips`
      process.stderr.write(`Control coverage incomplete: ${counts}. See control-coverage.json\n`)
      return { status: 'failed' }
    }
    return { status: result.status }
  }
}

function sourceFingerprint(): string {
  const files = execFileSync('git', [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
  ], { encoding: 'utf8' })
  const fingerprint = createHash('sha256')
  for (const file of Array.from(new Set(files.split('\0').filter(Boolean))).sort()) {
    fingerprint.update(file).update(existsSync(file) ? readFileSync(file) : 'missing')
  }
  return fingerprint.digest('hex')
}
