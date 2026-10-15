function commandAt(source: string, index: number) {
  const rest = source.slice(index)
  const verb = /^\\verb\*?([^a-z\s])/iu.exec(rest)
  if (verb !== null && verb[1] !== undefined) {
    const end = rest.indexOf(verb[1], verb[0].length)
    if (end >= 0) {
      return { text: rest.slice(0, end + 1), environmentDelta: 0 }
    }
  }
  const environment = /^\\(begin|end)\s*\{[^}]*\}/u.exec(rest)
  if (environment !== null) {
    return { text: environment[0], environmentDelta: environment[1] === 'begin' ? 1 : -1 }
  }
  return { text: /^\\(?:[a-z]+|.)/iu.exec(rest)?.[0] ?? '\\', environmentDelta: 0 }
}

function outerRowBreak(command: string, braces: number, environments: number): boolean {
  return braces === 0 && environments === 0 && ['\\\\', '\\newline'].includes(command)
}

/** Keep authored TeX intact; give only outer display-row breaks an array context. */
export function displayMathSource(source: string): string {
  let braces = 0
  let environments = 0
  for (let index = 0; index < source.length; index++) {
    const character = source[index]
    if (character === '%') {
      const newline = source.indexOf('\n', index)
      if (newline < 0) {
        break
      }
      index = newline
    }
    else if (character === '\\') {
      const command = commandAt(source, index)
      if (outerRowBreak(command.text, braces, environments)) {
        return `\\begin{gathered}${source}\n\\end{gathered}`
      }
      environments = Math.max(0, environments + command.environmentDelta)
      index += command.text.length - 1
    }
    else if (character === '{') {
      braces++
    }
    else if (character === '}') {
      braces = Math.max(0, braces - 1)
    }
  }
  return source
}
