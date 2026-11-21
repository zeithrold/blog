export const frameOrigins = [
  'https://www.youtube-nocookie.com',
  'https://www.youtube.com',
  'https://player.vimeo.com',
] as const

function youtubeFrame(url: URL): string | null {
  if (url.origin === frameOrigins[0] || url.origin === frameOrigins[1]) {
    if (/^\/embed\/[\w-]{11}$/.test(url.pathname)) {
      return url.href
    }
  }
  let id: string | null = null
  if (url.hostname === 'youtu.be') {
    id = url.pathname.slice(1)
  }
  else if (['youtube.com', 'www.youtube.com'].includes(url.hostname) && url.pathname === '/watch') {
    id = url.searchParams.get('v')
  }
  return id !== null && /^[\w-]{11}$/.test(id) ? `${frameOrigins[0]}/embed/${id}` : null
}

function vimeoFrame(url: URL): string | null {
  if (url.origin === frameOrigins[2] && /^\/video\/\d+$/.test(url.pathname)) {
    return url.href
  }
  if (!['vimeo.com', 'www.vimeo.com'].includes(url.hostname)) {
    return null
  }
  const id = /^\/(\d+)$/.exec(url.pathname)?.[1]
  return id === undefined ? null : `${frameOrigins[2]}/video/${id}${url.search}`
}

export function embedFrameUrl(url: string): string | null {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || parsed.port !== '' || parsed.username !== '' || parsed.password !== '') {
    return null
  }
  return youtubeFrame(parsed) ?? vimeoFrame(parsed)
}
