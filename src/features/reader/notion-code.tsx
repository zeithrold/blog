import type { ComponentProps, ReactNode } from 'react'
import { Code } from 'react-notion-x/third-party/code'
// Prism components register against the core initialized by Code. Keep the
// list explicit, with C before C++, rather than bundling Prism's loader.
import 'prismjs/components/prism-bash.min.js'
import 'prismjs/components/prism-c.min.js'
import 'prismjs/components/prism-cpp.min.js'
import 'prismjs/components/prism-csharp.min.js'
import 'prismjs/components/prism-docker.min.js'
import 'prismjs/components/prism-go.min.js'
import 'prismjs/components/prism-java.min.js'
import 'prismjs/components/prism-python.min.js'
import 'prismjs/components/prism-rust.min.js'
import 'prismjs/components/prism-sql.min.js'
import 'prismjs/components/prism-toml.min.js'
import 'prismjs/components/prism-yaml.min.js'

const notionLanguageAliases: ReadonlyMap<string, string> = new Map([
  ['c#', 'csharp'],
  ['plain text', 'plain'],
])

export function ReaderCode({ block, ...props }: ComponentProps<typeof Code>): ReactNode {
  const label = block.properties.language[0]?.[0].trim().toLowerCase()
  const language = label === undefined ? undefined : notionLanguageAliases.get(label)
  if (language === undefined) {
    return <Code {...props} block={block} />
  }
  const properties = {
    ...block.properties,
    language: [
      [language] satisfies typeof block.properties.language[number],
    ],
  }
  return <Code {...props} block={{ ...block, properties }} />
}
