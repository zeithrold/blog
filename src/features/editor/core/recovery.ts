import type { Document } from '@/content/document'
import { z } from 'zod'
import { UUID, validateDocument } from '@/content/document'

const recoverySchema = z.strictObject({
  owner: z.string().min(1),
  documentId: UUID,
  baseRevisionId: UUID,
  editSeq: z.number().int().nonnegative(),
  savedAt: z.number().int().nonnegative(),
  document: z.unknown().transform(input => validateDocument(input)),
})
export type Recovery = {
  owner: string
  documentId: string
  baseRevisionId: string
  editSeq: number
  savedAt: number
  document: Document
}

async function open(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open('ztd.blog.cms.recovery.v1', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('snapshots')
    }
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    request.onsuccess = () => resolve(request.result)
  })
}
export async function recovery(
  owner: string,
  documentId: string,
  snapshot?: Recovery,
): Promise<Recovery | null> {
  const db = await open()
  const key = `${owner}:${documentId}:blog-blocknote-v1`
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        'snapshots',
        snapshot !== undefined ? 'readwrite' : 'readonly',
      )
      const store = tx.objectStore('snapshots')
      const request = snapshot !== undefined ? store.put(snapshot, key) : store.get(key)
      let result: Recovery | null = null
      request.onsuccess = () => {
        if (snapshot !== undefined) {
          result = snapshot
          return
        }
        try {
          const value: unknown = request.result
          const parsed = recoverySchema.safeParse(value)
          if (
            parsed.success
            && parsed.data.owner === owner
            && parsed.data.documentId === documentId
          ) {
            result = parsed.data
          }
        }
        catch {
          result = null
        }
      }
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    })
  }
  finally {
    db.close()
  }
}
