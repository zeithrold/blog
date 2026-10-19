import { ContentError } from '@/content/document'

export class JSONScanner {
  private index = 0
  constructor(private readonly source: string) {}
  private fail(): never {
    throw new ContentError('INVALID_JSON', 400)
  }

  private space(): void {
    while (/\s/.test(this.source[this.index] ?? '') && this.index < this.source.length) {
      this.index++
    }
  }

  private string(): string {
    const start = this.index++
    while (this.index < this.source.length) {
      const ch = this.source[this.index++]
      if (ch === '\\') {
        this.index++
      }
      else if (ch === '"') {
        try {
          const result: unknown = JSON.parse(this.source.slice(start, this.index))
          return typeof result === 'string' ? result : this.fail()
        }
        catch {
          this.fail()
        }
      }
    }
    return this.fail()
  }

  private key(keys: Set<string>): void {
    if (this.source[this.index] !== '"') {
      this.fail()
    }
    const key = this.string()
    if (keys.has(key)) {
      this.fail()
    }
    keys.add(key)
    this.space()
    if (this.source[this.index++] !== ':') {
      this.fail()
    }
  }

  private container(object: boolean, depth: number): void {
    const end = object ? '}' : ']'
    const keys = new Set<string>()
    this.index++
    this.space()
    if (this.source[this.index] === end) {
      this.index++
      return
    }
    for (;;) {
      this.space()
      if (object) {
        this.key(keys)
      }
      this.value(depth + 1)
      this.space()
      if (this.source[this.index] === end) {
        this.index++
        return
      }
      if (this.source[this.index++] !== ',') {
        this.fail()
      }
    }
  }

  private value(depth: number): void {
    if (depth > 48) {
      this.fail()
    }
    this.space()
    const ch = this.source[this.index]
    if (ch === '"') {
      this.string()
      return
    }
    if (ch === '{' || ch === '[') {
      this.container(ch === '{', depth)
      return
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
      this.source.slice(this.index),
    )
    if (match === null) {
      this.fail()
    }
    this.index += match[0].length
  }

  scan(): void {
    this.value(0)
    this.space()
    if (this.index !== this.source.length) {
      this.fail()
    }
  }
}
