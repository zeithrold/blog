import type { AssetRole } from '@/content/asset-refs'
import { Problem } from '@/server/problem'

const MiB = 1048576
const policies: Record<
  AssetRole,
  {
    limit: number
    types: Record<string, string[]>
  }
> = {
  image: {
    limit: 8 * MiB,
    types: {
      'image/png': ['png'],
      'image/jpeg': ['jpg', 'jpeg'],
    },
  },
  poster: {
    limit: 8 * MiB,
    types: {
      'image/png': ['png'],
      'image/jpeg': ['jpg', 'jpeg'],
    },
  },
  audio: {
    limit: 32 * MiB,
    types: {
      'audio/mpeg': ['mp3'],
      'audio/wav': ['wav'],
    },
  },
  video: {
    limit: 64 * MiB,
    types: {
      'video/mp4': ['mp4'],
      'video/webm': ['webm'],
    },
  },
  file: {
    limit: 16 * MiB,
    types: {
      'application/pdf': ['pdf'],
      'text/plain': ['txt'],
      'application/zip': ['zip'],
    },
  },
  caption: {
    limit: MiB,
    types: {
      'text/vtt': ['vtt'],
    },
  },
}
export function mediaPolicy(input: {
  role: AssetRole
  type: string
  bytes: number
  filename: string
}): string {
  const policy = policies[input.role]
  if (input.bytes > policy.limit) {
    throw new Problem(413, 'ASSET_TOO_LARGE')
  }
  const extension = input.filename.split('.').at(-1)?.toLowerCase() ?? ''
  if (policy.types[input.type]?.includes(extension) !== true) {
    throw new Problem(415, 'ASSET_TYPE_UNSUPPORTED')
  }
  return input.filename
    .replace(/[\\/\p{Cc}]/gu, '_')
    .normalize('NFC')
    .slice(0, 240)
}
function starts(bytes: Uint8Array, expected: number[]): boolean {
  return expected.every((byte, index) => bytes[index] === byte)
}
function dimensions(
  width: number,
  height: number,
): {
  width: number
  height: number
} {
  if (
    width < 1
    || height < 1
    || width > 10000
    || height > 10000
    || width * height > 20000000
  ) {
    throw new Problem(422, 'IMAGE_DIMENSIONS_INVALID')
  }
  return {
    width,
    height,
  }
}
function jpeg(bytes: Uint8Array): {
  width: number
  height: number
} {
  if (!starts(bytes, [
    255,
    216,
    255,
  ])) {
    throw new Problem(422, 'ASSET_SIGNATURE_INVALID')
  }
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 255) {
      break
    }
    const marker = bytes[offset + 1]
    const size = u16(bytes, offset + 2)
    if (size < 2) {
      break
    }
    if (marker === 192 || marker === 193 || marker === 194) {
      return dimensions(u16(bytes, offset + 7), u16(bytes, offset + 5))
    }
    offset += size + 2
  }
  throw new Problem(422, 'JPEG_HEADER_INVALID')
}
function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end))
}
export function sniff(
  type: string,
  prefix: Uint8Array,
  tail: Uint8Array,
  size: number,
): {
  width: number | null
  height: number | null
} {
  if (type === 'image/jpeg') {
    if (tail.at(-2) !== 255 || tail.at(-1) !== 217) {
      throw new Problem(422, 'IMAGE_TRUNCATED')
    }
    return jpeg(prefix)
  }
  if (type === 'image/png') {
    return png(prefix, tail)
  }
  if (signature(type, prefix, size) !== true) {
    throw new Problem(422, 'ASSET_SIGNATURE_INVALID')
  }
  return {
    width: null,
    height: null,
  }
}
export function validateCaptions(text: string): void {
  if (!/^WEBVTT(?:\r?\n|\s)/.test(text) || /<|^\s*(?:STYLE|REGION)\b/m.test(text)) {
    throw new Problem(422, 'CAPTIONS_INVALID')
  }
  const blocks = text
    .trim()
    .split(/\r?\n\r?\n/)
    .slice(1)
  if (blocks.length > 10000) {
    throw new Problem(422, 'CAPTIONS_INVALID')
  }
  for (const block of blocks) {
    const lines = block.split(/\r?\n/)
    const timing = lines.find(line => line.includes('-->'))
    if (
      timing === undefined
      || !/^(?:\d{2}:)?[0-5]\d:[0-5]\d\.\d{3} --> (?:\d{2}:)?[0-5]\d:[0-5]\d\.\d{3}$/.test(
        timing,
      )
    ) {
      throw new Problem(422, 'CAPTIONS_INVALID')
    }
    const times = timing
      .split(' --> ')
      .map(value => value.split(':').reduce((total, part) => total * 60 + Number(part), 0))
    if (times[0] === undefined || times[1] === undefined || times[1] <= times[0]) {
      throw new Problem(422, 'CAPTIONS_INVALID')
    }
  }
}

function u16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) * 256 + (bytes[offset + 1] ?? 0)
}

function png(prefix: Uint8Array, tail: Uint8Array): { width: number, height: number } {
  if (
    prefix.length < 33
    || !starts(prefix, [
      137,
      80,
      78,
      71,
      13,
      10,
      26,
      10,
    ])
    || ascii(prefix, 12, 16) !== 'IHDR'
    || ascii(tail, tail.length - 8, tail.length - 4) !== 'IEND'
  ) {
    throw new Problem(422, 'ASSET_SIGNATURE_INVALID')
  }
  const view = new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength)
  return dimensions(view.getUint32(16), view.getUint32(20))
}
function signature(type: string, bytes: Uint8Array, size: number): boolean {
  const signatures: Record<string, () => boolean> = {
    'application/pdf': () => ascii(bytes, 0, 5) === '%PDF-',
    'application/zip': () => starts(bytes, [
      80,
      75,
      3,
      4,
    ]) || starts(bytes, [
      80,
      75,
      5,
      6,
    ]),
    'audio/mpeg': () =>
      ascii(bytes, 0, 3) === 'ID3' || (bytes[0] === 255 && ((bytes[1] ?? 0) & 224) === 224),
    'audio/wav': () =>
      ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WAVE' && bytes.length >= 44,
    'video/mp4': () => ascii(bytes, 4, 8) === 'ftyp' && size >= 24,
    'video/webm': () => starts(bytes, [
      26,
      69,
      223,
      163,
    ]),
    'text/plain': () => true,
    'text/vtt': () => true,
  }
  return signatures[type]?.() === true
}
