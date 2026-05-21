import { constructURL } from './google-fonts-helper'

const defaultFontConfig = {
  wght: [
    500,
    700,
  ],
  ital: [500],
}

const requiredFontList = [
  'Noto Sans',
  'Noto Serif',
  'Noto Sans SC',
  'Noto Serif SC',
  'Noto Sans JP',
  'Noto Serif JP',
  'Noto Sans KR',
  'Noto Serif KR',
]

const constructedFontsUrl = constructURL({
  families: {
    ...Object.fromEntries(
      requiredFontList.map(font => [
        font,
        defaultFontConfig,
      ]),
    ),
    'Noto Sans Mono': {
      wght: [400],
    },
  },
  display: 'swap',
})

export const fontsUrl = constructedFontsUrl !== false
  ? constructedFontsUrl
  : 'https://fonts.googleapis.com/css2?family=Roboto'
