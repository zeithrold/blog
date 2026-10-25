// The formulas the editor preview and the reader have to lay out: an aligned expression, a
// tall fraction, a matrix and a line wide enough to scroll in the reading column.
export const EDITOR_MATH_SOURCES = [
  'x = 123',
  String.raw`\frac{1+\sqrt{1+x^2}}{\frac{a}{b}+\frac{c}{d}}`,
  String.raw`\begin{matrix}a&b\\c&d\end{matrix}`,
  `${'x+'.repeat(69)}x`,
] as const
