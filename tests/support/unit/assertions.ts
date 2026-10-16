import assert from 'node:assert/strict'

export function equal(actual: unknown, expected: unknown, message?: string): void {
  assert.equal(actual, expected, message)
}
export function deepEqual(actual: unknown, expected: unknown): void {
  assert.deepEqual(actual, expected)
}
