import process from 'node:process'
import { SupabaseClient } from '@supabase/supabase-js'
import 'dotenv/config'

const admin = new SupabaseClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

export default admin
