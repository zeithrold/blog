import type * as T from 'fp-ts/Task'
import simple from './simple'
import soft, { type SoftSearchTagResult } from './soft'

export enum SearchMode {
  Simple = 'simple',
  Soft = 'soft',
}

function search(mode: SearchMode.Simple, tags: string[]): T.Task<string[]>
function search(mode: SearchMode.Soft, tags: string[]): T.Task<SoftSearchTagResult[]>

function search(mode: SearchMode, tags: string[]) {
  switch (mode) {
    case SearchMode.Simple:
      return simple(tags)
    case SearchMode.Soft:
      return soft(tags)
  }
}

export default search
