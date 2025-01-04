import type { CookieOptions } from '@supabase/ssr'
import type { Context } from 'hono'
import process from 'node:process'
import { createServerClient } from '@supabase/ssr'
import { getCookie, setCookie } from 'hono/cookie'

const SUPABASE_URL = process.env.SUPABASE_URL as string
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string

interface SupabaseGetCookie {
  name: string
  value: string
}

interface SupabaseSetCookie {
  name: string
  value: string
  options: CookieOptions
}

type HonoCookieSameSite = 'Strict' | 'Lax' | 'None' | 'strict' | 'lax' | 'none'
type HonoCookiePriority = 'Low' | 'Medium' | 'High'

type HonoCookieOptions = CookieOptions & {
  sameSite?: HonoCookieSameSite
  priority?: HonoCookiePriority
}

function cookiesGetAll(c: Context): () => SupabaseGetCookie[] {
  return () => {
    const cookies = getCookie(c)
    return Object.entries(cookies).map(([name, value]) => ({ name, value }))
  }
}

function cookiesSetAll(c: Context): (cookies: SupabaseSetCookie[]) => void {
  return (cookies) => {
    for (const cookie of cookies) {
      setCookie(
        c,
        cookie.name,
        cookie.value,
        cookie.options as HonoCookieOptions,
      )
    }
  }
}

function supabaseCookieOptions(c: Context) {
  return {
    cookies: {
      getAll: cookiesGetAll(c),
      setAll: cookiesSetAll(c),
    },
  }
}

export function createSupabase(c: Context) {
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    supabaseCookieOptions(c),
  )
}
