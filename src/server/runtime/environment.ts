import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts'

export type Environment = {
  DB: D1Database
  MEDIA: R2Bucket
  ASSETS: {
    fetch: (request: Request) => Promise<Response>
  }
  PUBLIC_ORIGIN: string
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  OWNER_SUBS?: string
  CSRF_SIGNING_SECRET?: string
  ALLOWED_PREVIEW_HOSTS?: string
  BUILD_SHA?: string
}
