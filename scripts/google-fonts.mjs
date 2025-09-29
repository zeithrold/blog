import { constructURL } from 'google-fonts-helper'

const defaultFontConfig = {
  wght: [
    400,
    700,
  ],
  ital: [400],
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

const sansFontList = requiredFontList.filter(font => font.includes('Noto Sans'))
const serifFontList = requiredFontList.filter(font => font.includes('Noto Serif'))

const fonts = constructURL({
  families: Object.fromEntries(
    requiredFontList.map(font => [
      font,
      defaultFontConfig,
    ]),
  ),
  display: 'swap',
}) || 'https://fonts.googleapis.com/css2?family=Roboto'

export default fonts

export {
  requiredFontList,
  sansFontList,
  serifFontList,
}
