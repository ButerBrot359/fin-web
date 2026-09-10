import type { AiConnectionPricing } from '@/entities/ai-connection'
import { parsePriceValue, priceValueText } from './price-value'

export const PRICE_KEYS = [
  'inputPerMillion',
  'outputPerMillion',
  'cacheReadPerMillion',
  'cacheWritePerMillion',
  'cacheWrite5mPerMillion',
  'cacheWrite1hPerMillion',
] as const
export type PricingDraft = Record<keyof AiConnectionPricing, string>
export const pricingDraft = (
  pricing?: AiConnectionPricing | null
): PricingDraft =>
  Object.fromEntries(
    PRICE_KEYS.map((key) => [key, priceValueText(pricing?.[key])])
  ) as PricingDraft
export const validPricing = (draft: PricingDraft): boolean =>
  PRICE_KEYS.every((key) => parsePriceValue(draft[key]) !== undefined)
export const pricingRequest = (draft: PricingDraft): AiConnectionPricing => {
  const result: AiConnectionPricing = {
    inputPerMillion: null,
    outputPerMillion: null,
    cacheReadPerMillion: null,
    cacheWritePerMillion: null,
    cacheWrite5mPerMillion: null,
    cacheWrite1hPerMillion: null,
  }
  for (const key of PRICE_KEYS) {
    const value = parsePriceValue(draft[key])
    if (value === undefined) throw new Error('Invalid pricing draft')
    result[key] = value
  }
  return result
}
