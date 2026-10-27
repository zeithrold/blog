import {
  adjacentLinkContent,
  adjacentLinks,
  charactersOf,
  openLinkWorkspace,
} from '../support/editor-link-remaining-fixtures'
import { editAndUnlinkRound, linkSelectionRound } from '../support/editor-link-remaining-ui'
import { test } from '../support/test'

const desktopSelections = [
  { from: 1, to: 3 },
  { from: 9, to: 14 },
  { from: 5, to: 6 },
  { from: 3, to: 7 },
] as const

// Each real selection now drives the editor operation before the exact local and packet outcomes.
test(
  'linking partial, following and crossing selections preserves all other characters and styles at 1440px',
  async ({ page }) => {
    const { api, body } = await openLinkWorkspace(page, { document: adjacentLinks(), width: 1440 })
    try {
      const original = charactersOf(adjacentLinkContent())
      for (const selection of desktopSelections) {
        await linkSelectionRound(page, api, body, { original, selection, width: 1440 })
      }
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  },
)

test('linking a mobile partial link preserves all other characters and styles at 320px', async ({ page }) => {
  const { api, body } = await openLinkWorkspace(page, { document: adjacentLinks(), width: 320 })
  try {
    const original = charactersOf(adjacentLinkContent())
    await linkSelectionRound(page, api, body, {
      original,
      selection: { from: 1, to: 3 },
      width: 320,
    })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

for (const width of [1440, 320]) {
  test(`existing link edits and unlink target the chosen adjacent link at ${width}px`, async ({ page }) => {
    const { api, body } = await openLinkWorkspace(page, { document: adjacentLinks(), width })
    try {
      await editAndUnlinkRound(page, api, body)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
