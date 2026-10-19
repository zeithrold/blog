import type { z } from 'zod'
import type { assetAllocationSchema, assetRoleSchema } from '@/contracts/media'
import type { Client } from '@/shared/admin/api-client'

export type MediaTransferSession = { allocation: z.infer<typeof assetAllocationSchema> | null }
type Role = z.infer<typeof assetRoleSchema>
const clients = new WeakMap<Client, WeakMap<File, Map<Role, MediaTransferSession>>>()

export function mediaTransferSession(client: Client, file: File, role: Role): MediaTransferSession {
  const files = clients.get(client) ?? new WeakMap<File, Map<Role, MediaTransferSession>>()
  const roles = files.get(file) ?? new Map<Role, MediaTransferSession>()
  const session = roles.get(role) ?? { allocation: null }
  clients.set(client, files)
  files.set(file, roles)
  roles.set(role, session)
  return session
}
