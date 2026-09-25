export interface PeriodChoiceProps {
  fromNodeId: string
  toNodeId: string
  sourceNodeId: string
  quarterOnly: boolean
}

export function readPeriodChoice(value: unknown): PeriodChoiceProps | null {
  if (value == null || typeof value !== 'object') return null
  const { fromNodeId, toNodeId, sourceNodeId, quarterOnly } = value as Record<
    string,
    unknown
  >
  if (
    typeof fromNodeId !== 'string' ||
    typeof toNodeId !== 'string' ||
    typeof sourceNodeId !== 'string'
  ) {
    return null
  }
  return {
    fromNodeId,
    toNodeId,
    sourceNodeId,
    quarterOnly: quarterOnly === true,
  }
}
