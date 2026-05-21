import { NextResponse } from 'next/server'
import { getBlogConfig } from '@/lib/config'
import { BlogConfigSchema } from '@/lib/config/schema'
import { checkHealth } from '@/lib/notion/posts'

/**
 *
 */
export async function GET() {
  try {
    const config = getBlogConfig()
    const parsed = BlogConfigSchema.safeParse(config)
    if (!parsed.success) {
      return NextResponse.json({ status: 'unhealthy', error: 'invalid config' }, { status: 503 })
    }
    const health = await checkHealth()
    return NextResponse.json(health)
  }
  catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: error instanceof Error ? error.message : 'unknown' },
      { status: 503 },
    )
  }
}
