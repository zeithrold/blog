import { safeURL } from '@/content/base'

export const linkURLLimit = 2048

export function normalizeLinkURL(input: string): string | null {
  const value = input.trim()
  if (value === '' || value.startsWith('//')) {
    return null
  }
  const normalized = completeLinkURL(value)
  return normalized !== null && normalized.length <= linkURLLimit && safeURL(normalized) ? normalized : null
}

function completeLinkURL(value: string): string | null {
  if (value.startsWith('/') || value.startsWith('#')) {
    return value
  }
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(value)?.[1]
  const hostPort = /^(?:localhost|(?:[a-z\d-]+\.)+[a-z\d-]+):\d+(?:[/?#]|$)/i.test(value)
  if (scheme === undefined || hostPort) {
    return `https://${value}`
  }
  const protocol = scheme.toLowerCase()
  return [
    'http',
    'https',
    'mailto',
  ].includes(protocol)
    ? protocol + value.slice(scheme.length)
    : null
}
