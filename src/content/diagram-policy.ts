const forbidden
  = /%%\{|(?:^|[;\n])\s*(?:click|style|classDef|linkStyle|href)\b|<[!a-z/]|https?:|data:|javascript:|url\s*\(|@\{/im
const entity = /&(?:[a-z]+|#x?[\da-f]+);/i
const supported
  = /^(?:(?:graph|flowchart)\s+(?:TB|TD|BT|LR|RL)\b|sequenceDiagram\b|stateDiagram-v2\b)/

export function validDiagram(source: string): boolean {
  if (
    source.length > 16384
    || !source.isWellFormed()
    || forbidden.test(source)
    || entity.test(source)
  ) {
    return false
  }
  const header
    = source
      .split('\n')
      .map(line => line.trim())
      .find(line => line !== '' && !line.startsWith('%%')) ?? ''
  const edges = source.match(/-->|---|==>|-\.->|->>/g)?.length ?? 0
  return supported.test(header) && edges <= 200
}
