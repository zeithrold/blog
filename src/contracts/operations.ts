import { z } from 'zod'

export const resumeInputSchema = z.strictObject({
  expectedGeneration: z.number().int().nonnegative(),
})
export const resumeSchema = z.strictObject({
  state: z.literal('writable'),
  publicGeneration: z.number().int().nonnegative(),
})
export const operationsSchema = z.strictObject({
  publicGeneration: z.number().int(),
  maintenance: z.number().int().min(0).max(1),
  contentBytes: z.number().int(),
  maintenanceSince: z.number().int().nullable(),
  maintenanceOwner: z.string().nullable(),
  databaseBytes: z.number().int(),
  capacity: z.enum([
    'normal',
    'warning',
    'critical',
  ]),
  pendingSchedules: z.number().int(),
  scheduleLagMs: z.number().int(),
  failedSchedules: z.number().int(),
  lastBackupAt: z.number().int().nullable(),
  documents: z.number().int().nonnegative(),
  revisions: z.number().int().nonnegative(),
  readyAssets: z.number().int().nonnegative(),
  assetBytes: z.number().int().nonnegative(),
  searchableDocuments: z.number().int().nonnegative(),
})
