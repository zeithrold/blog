export function publicationPath(kind: 'article' | 'page', slug: string): string {
  return `/${kind === 'article' ? 'posts' : 'pages'}/${slug}`
}
