function youtubeFrame(url: URL): string | null {
  let id: string | null = null
  if (url.hostname === 'youtu.be') {
    id = url.pathname.slice(1)
  }
  else if (['youtube.com', 'www.youtube.com'].includes(url.hostname) && url.pathname === '/watch') {
    id = url.searchParams.get('v')
  }
  return id !== null && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
}

function vimeoFrame(url: URL): string | null {
  if (!['vimeo.com', 'www.vimeo.com'].includes(url.hostname)) {
    return null
  }
  const id = /^\/(\d+)$/.exec(url.pathname)?.[1]
  return id === undefined ? null : `https://player.vimeo.com/video/${id}${url.search}`
}

export function embedFrameUrl(url: string): string | null {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') {
    return null
  }
  return youtubeFrame(parsed) ?? vimeoFrame(parsed) ?? parsed.href
}
