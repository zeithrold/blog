import DOMPurify from 'dompurify'
import { marked, Marked } from 'marked'
import plaintify from 'marked-plaintify'

const plainMarked = new Marked().use(plaintify())

/**
 * Split the query string into a list for database queries.
 *
 * It take quoted strings as a single element first (with quotes removed),
 * then it takes the rest of the string as separate elements.
 *
 * @param query The query to split
 */
export function split(query: string) {
  const quoted = query.match(/"[^"]*"/g) || []
  const rest = query.replace(/"[^"]*"/g, '').split(/\s+/)
  return [...quoted.map(q => q.slice(1, -1)), ...rest]
}

/**
 * Render markdown to HTML.
 *
 * This sanitizes the HTML output to prevent XSS attacks.
 */
export async function renderMarkdownHtml(markdown: string) {
  return DOMPurify.sanitize(await marked(markdown))
}

/**
 * Render markdown to plaintext
 */
export async function renderMarkdownPlainText(markdown: string) {
  return plainMarked.parse(markdown)
}

/**
 * Render markdown to plaintext and get the first 200 characters.
 */
export async function makeExcerpt(markdown: string) {
  return (await plainMarked.parse(markdown)).slice(0, 200)
}
