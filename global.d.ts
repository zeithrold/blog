/// <reference types="vite/client" />
/// <reference types="vike-solid/client" />
/// <reference types="unplugin-fonts/client" />

import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { HonoRequest } from 'hono'

import type {
  PageContext,
  PageContextClient,
  PageContextServer,
} from 'vike/types'

interface ImportMetaEnv {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  POSTGRES_URL: string
  POSTGRES_SCHEMA: string
}

interface ImportMeta { readonly env: ImportMetaEnv }

interface ContextData {
  supabase: SupabaseClient
  user: User | null
}

declare global {namespace Vike {interface PageContext extends ContextData {}}}

declare module 'hono' {interface ContextVariableMap extends ContextData {}}
