import type { Error } from '..'
import { DrizzleError } from 'drizzle-orm'
import { PostgresError } from 'postgres'

export default function sql(error: unknown): Error | undefined {
  if (error instanceof PostgresError) {
    return {
      id: 'sql_error_postgres',
      description: `Postgres error: ${error.message}`,
      status: 500,
      internal: true,
      stack: error,
    }
  }
  if (error instanceof DrizzleError) {
    return {
      id: 'sql_error_drizzle',
      description: `Drizzle error: ${error.message}`,
      status: 500,
      internal: true,
      stack: error,
    }
  }
}
