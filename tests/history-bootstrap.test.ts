import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { historyBootstrap } from '../src/shared/admin/history-bootstrap'
import { historyPosition } from '../src/shared/admin/history-navigation'
import { deepEqual, equal } from './assertions'

class MemoryHistory {
  entries: unknown[] = [
    { __vinext_historyIndex: 0, preserved: 'initial' },
  ]

  index = 0
  get state(): unknown { return this.entries[this.index] }
  pushState(data: unknown): void {
    this.entries.splice(++this.index, Infinity, data)
  }

  replaceState(data: unknown): void {
    this.entries[this.index] = data
  }
}

function bootstrap() {
  const history = new MemoryHistory()
  const window = Object.assign(new EventTarget(), { history })
  const context = { window, crypto, Event }
  runInNewContext(historyBootstrap, context)
  const emit = (type: string): void => {
    window.dispatchEvent(new Event(type))
  }
  return { history, context, emit, window }
}

test('early bootstrap marks captured native router writes and physical positions after branching', () => {
  const { history, context, emit } = bootstrap()
  const capturedPush = history.pushState.bind(history)
  const capturedReplace = history.replaceState.bind(history)
  equal(historyPosition(history.state)?.index, 0)
  capturedPush({ __vinext_historyIndex: 1, metadata: 'first' })
  capturedPush({ __vinext_historyIndex: 2, metadata: 'second' })
  history.index--
  emit('popstate')
  capturedPush({ __vinext_historyIndex: 3, metadata: 'branch' })
  equal(history.index, 2)
  equal(historyPosition(history.state)?.index, 2)
  const session = historyPosition(history.state)?.session
  capturedReplace({ __vinext_historyIndex: 3, metadata: 'replacement' })
  equal(historyPosition(history.state)?.index, 2)
  deepEqual(JSON.parse(JSON.stringify(history.state)), {
    __vinext_historyIndex: 3,
    metadata: 'replacement',
    __blogHistory: { session, index: 2 },
  })
  runInNewContext(historyBootstrap, context)
  equal(historyPosition(history.state)?.session, session)
  equal(history.entries.length, 3)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('native hash entries receive a position and back/forward preserves their existing marker', () => {
  const { history, emit } = bootstrap()
  history.entries.push(null)
  history.index++
  emit('popstate')
  emit('hashchange')
  equal(historyPosition(history.state)?.index, 1)
  history.index--
  emit('popstate')
  emit('hashchange')
  equal(historyPosition(history.state)?.index, 0)
  history.index++
  emit('popstate')
  emit('hashchange')
  equal(historyPosition(history.state)?.index, 1)
  equal(history.entries.length, 2)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('the early history bridge can stop router listeners installed before React mounts', () => {
  const { window, emit } = bootstrap()
  let router = 0
  window.addEventListener('popstate', () => router++)
  window.addEventListener('blog:history-pop', event => event.preventDefault())
  emit('popstate')
  equal(router, 0)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
