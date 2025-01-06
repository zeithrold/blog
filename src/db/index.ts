import process from 'node:process'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const POSTGRES_URL = process.env.POSTGRES_URL as string

export const client = postgres(POSTGRES_URL, {
  prepare: false,
})

export const db = drizzle({ client, schema })
