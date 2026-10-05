export const fitColumnWidths = (
  widths: number[],
  fixed: boolean[],
  available: number,
  minWidth: number | number[]
): number[] => {
  const total = widths.reduce((a, b) => a + b, 0)
  if (total <= 0 || total <= available) return widths
  const fixedSum = widths.reduce((a, w, i) => (fixed[i] ? a + w : a), 0)
  if (total - fixedSum <= 0) return widths
  const floors = widths.map((w, i) =>
    Math.min(w, typeof minWidth === 'number' ? minWidth : minWidth[i])
  )
  const pinned = widths.map((_, i) => fixed[i])
  for (;;) {
    const pinnedSum = widths.reduce(
      (a, w, i) => (pinned[i] ? a + (fixed[i] ? w : floors[i]) : a),
      0
    )
    const freeSum = widths.reduce((a, w, i) => (pinned[i] ? a : a + w), 0)
    if (freeSum <= 0) break
    const scale = Math.min(1, Math.max(0, available - pinnedSum) / freeSum)
    const tooNarrow = widths
      .map((w, i) => (!pinned[i] && w * scale < floors[i] ? i : -1))
      .filter((i) => i >= 0)
    tooNarrow.forEach((i) => {
      pinned[i] = true
    })
    if (tooNarrow.length === 0) {
      return widths.map((w, i) =>
        fixed[i] ? w : pinned[i] ? floors[i] : Math.round(w * scale)
      )
    }
  }
  return widths.map((w, i) => (fixed[i] ? w : floors[i]))
}
