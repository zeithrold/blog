export const CODE_LANGUAGES = [
  { value: 'text', name: 'Plain text' },
  { value: 'bash', name: 'Shell', aliases: ['sh', 'shell'] },
  { value: 'c', name: 'C' },
  { value: 'cpp', name: 'C++', aliases: ['c++'] },
  { value: 'csharp', name: 'C#', aliases: ['c#', 'cs'] },
  { value: 'css', name: 'CSS' },
  { value: 'diff', name: 'Diff' },
  { value: 'dockerfile', name: 'Dockerfile' },
  { value: 'go', name: 'Go' },
  { value: 'graphql', name: 'GraphQL' },
  { value: 'html', name: 'HTML' },
  { value: 'java', name: 'Java' },
  { value: 'javascript', name: 'JavaScript', aliases: ['js'] },
  { value: 'json', name: 'JSON' },
  { value: 'kotlin', name: 'Kotlin', aliases: ['kt'] },
  { value: 'markdown', name: 'Markdown', aliases: ['md'] },
  { value: 'php', name: 'PHP' },
  { value: 'python', name: 'Python', aliases: ['py'] },
  { value: 'ruby', name: 'Ruby', aliases: ['rb'] },
  { value: 'rust', name: 'Rust', aliases: ['rs'] },
  { value: 'sql', name: 'SQL' },
  { value: 'swift', name: 'Swift' },
  { value: 'typescript', name: 'TypeScript', aliases: ['ts'] },
  { value: 'xml', name: 'XML' },
  { value: 'yaml', name: 'YAML', aliases: ['yml'] },
] as const

export function codeLanguageName(language: string): string {
  return CODE_LANGUAGES.find(item => item.value === language)?.name ?? language
}

type HighlightLanguage = Exclude<(typeof CODE_LANGUAGES)[number]['value'], 'text'>

export function highlightCodeLanguage(language: string): HighlightLanguage | undefined {
  const known = CODE_LANGUAGES.find((item) => {
    const aliases: readonly string[] = 'aliases' in item ? item.aliases : []
    return item.value === language || aliases.includes(language)
  })
  return known?.value === 'text' ? undefined : known?.value
}
