const editorColors = [
  'default',
  'gray',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
] as const

export function colorOptions(labels: Record<typeof editorColors[number], string>, kind: 'text' | 'background'): {
  value: string
  label: string
  testId: string
  foreground: string
  background: string
}[] {
  return editorColors.map(value => ({
    value,
    label: labels[value],
    testId: `${kind}-color-${value}`,
    foreground: kind === 'text' && value !== 'default' ? `var(--blog-inline-${value})` : 'var(--color-foreground)',
    background: kind === 'background' && value !== 'default' ? `var(--blog-highlight-${value})` : 'transparent',
  }))
}
