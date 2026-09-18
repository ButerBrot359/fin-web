/** Blank means unknown. Zero is an explicit free rate, never a blank fallback. */
export function parsePriceValue(raw: string): number | null | undefined {
  const normalized = raw.trim().replace(',', '.')
  if (!normalized) return null
  if (!/^(?:\d{1,12}(?:\.\d{0,12})?|\.\d{1,12})$/.test(normalized))
    return undefined
  const value = Number(normalized)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

export function priceValueText(value: number | null | undefined): string {
  return value == null
    ? ''
    : new Intl.NumberFormat('en-US', {
        useGrouping: false,
        maximumFractionDigits: 20,
      }).format(value)
}
