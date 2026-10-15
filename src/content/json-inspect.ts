import { ContentError } from '@/content/base'
// Bound recursion and reject malformed Unicode before invoking recursive schemas.
export function inspectJSON(
  value: unknown,
  depth = 0,
  budget = {
    nodes: 0,
  },
): void {
  if (depth > 48 || ++budget.nodes > 600000) {
    throw new ContentError('INVALID_JSON', 400)
  }
  if (typeof value === 'string') {
    checkString(value)
  }
  else if (Array.isArray(value)) {
    for (const item of value) {
      inspectJSON(item, depth + 1, budget)
    }
  }
  else if (value !== null && typeof value === 'object') {
    inspectObject(value, depth + 1, budget)
  }
}

function inspectObject(value: object, depth: number, budget: { nodes: number }): void {
  for (const [key, item] of Object.entries(value)) {
    if ([
      '__proto__',
      'constructor',
      'prototype',
    ].includes(key)) {
      throw new ContentError('INVALID_JSON', 400)
    }
    inspectJSON(item, depth, budget)
  }
}

function checkString(value: string): void {
  if (!value.isWellFormed()) {
    throw new ContentError('INVALID_JSON', 400)
  }
}
