export class SqlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SqlError'
  }
}

export function sql(error: Error) {
  return new SqlError(`SQL error: ${error.message}`)
}
