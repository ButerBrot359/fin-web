/**
 * Ступени ширины поля для диалога «Изменить форму» (решение владельца 11.09:
 * пиксели непонятны пользователю — выбор из именованных ступеней). Значения
 * в px уходят в тот же патч `width`; произвольный px (например, выставленный
 * ИИ-помощником) отображается ближайшей ступенью.
 */
export type WidthStepKey = 'auto' | 'narrow' | 'medium' | 'wide'

export const WIDTH_STEPS: { key: WidthStepKey; px: number | undefined }[] = [
  { key: 'auto', px: undefined },
  { key: 'narrow', px: 160 },
  { key: 'medium', px: 320 },
  { key: 'wide', px: 480 },
]

export function widthToStep(width: number | undefined): WidthStepKey {
  if (width === undefined) return 'auto'
  let best: WidthStepKey = 'narrow'
  let bestDistance = Number.POSITIVE_INFINITY
  for (const step of WIDTH_STEPS) {
    if (step.px === undefined) continue
    const distance = Math.abs(step.px - width)
    if (distance < bestDistance) {
      bestDistance = distance
      best = step.key
    }
  }
  return best
}

export function stepToWidth(step: WidthStepKey): number | undefined {
  return WIDTH_STEPS.find((s) => s.key === step)?.px
}
