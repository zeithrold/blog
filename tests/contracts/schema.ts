import { z } from 'zod'

export const layerSchema = z.enum([
  'unit',
  'integration',
  'dom',
  'component',
  'e2e',
])
const referenceSchema = z.strictObject({
  file: z.string().regex(/^tests\/.+\.(?:test|integration|spec)\.ts$/),
  title: z.string().min(1),
  describe: z.array(z.string()).optional(),
})
// A DOM case is a Vitest case in the jsdom harness. It names no project: the
// layer exists because the behavior needs a document, not an engine.
const domReferenceSchema = z.strictObject({
  file: z.string().regex(/^tests\/dom\/.+\.test\.tsx$/),
  title: z.string().min(1),
  describe: z.array(z.string()).optional(),
})
const browserReferenceSchema = referenceSchema.extend({
  projects: z.array(z.enum(['chromium', 'webkit'])).min(1),
})
export const contractSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9.-]+$/),
  behavior: z.string().min(1),
  primary: layerSchema,
  unit: z.array(referenceSchema),
  integration: z.array(referenceSchema),
  dom: z.array(domReferenceSchema).default([]),
  component: z.array(browserReferenceSchema),
  e2e: z.array(browserReferenceSchema),
  dimensions: z.array(z.string()),
  rationale: z.string().min(1),
})
export const sourceSchema = z.strictObject({
  revision: z.string().min(1),
  fingerprint: z.string().min(1),
})
export const layerEvidenceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  layer: layerSchema,
  runId: z.uuid().nullable(),
  source: sourceSchema,
  complete: z.boolean(),
  cases: z.array(z.strictObject({
    file: z.string().min(1),
    title: z.string().min(1),
    describe: z.array(z.string()),
    project: z.enum(['chromium', 'webkit']).optional(),
    status: z.string(),
    retry: z.number().int().nonnegative(),
    annotations: z.array(z.strictObject({
      type: z.string(),
      description: z.string().optional(),
    })).optional(),
  })),
})
