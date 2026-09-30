export const fitColumnWidths = (
  widths: number[],
  fixed: boolean[],
  available: number,
  minWidth: number
): number[] => {
  const total = widths.reduce((a, b) => a + b, 0)
  if (total <= 0 || total <= available) return widths
  const fixedSum = widths.reduce((a, w, i) => (fixed[i] ? a + w : a), 0)
  const flexSum = total - fixedSum
  if (flexSum <= 0) return widths
  const scale = Math.min(1, Math.max(0, available - fixedSum) / flexSum)
  return widths.map((w, i) =>
    fixed[i] ? w : Math.max(minWidth, Math.round(w * scale))
  )
}
