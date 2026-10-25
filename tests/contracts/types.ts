export type Layer = 'unit' | 'integration' | 'component' | 'e2e'
export type Browser = 'chromium' | 'webkit'

export type NodeReference = { file: string, title: string, describe?: readonly string[] }
export type BrowserReference = NodeReference & { projects: readonly Browser[] }
export type VerificationContract = {
  id: string
  behavior: string
  primary: Layer
  unit: readonly NodeReference[]
  integration: readonly NodeReference[]
  component: readonly BrowserReference[]
  e2e: readonly BrowserReference[]
  dimensions: readonly string[]
  rationale: string
}

export type CaseEvidence = {
  file: string
  title: string
  describe: string[]
  project?: Browser
  status: string
  retry: number
  annotations?: { type: string, description?: string }[]
}

export type SourceIdentity = { revision: string, fingerprint: string }
export type LayerEvidence = {
  schemaVersion: 1
  layer: Layer
  runId: string | null
  source: SourceIdentity
  complete: boolean
  cases: CaseEvidence[]
}
