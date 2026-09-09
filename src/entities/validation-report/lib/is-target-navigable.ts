import type { ValidationTarget } from '../types/validation-report'

/**
 * «Можно перейти» решает ТОЛЬКО target (v2 §2.4): из severity/source
 * навигируемость не выводится. Парсер уже гарантирует полноту полей каждого
 * вида, поэтому здесь достаточно отсечь безадресные и DOCUMENT.
 */
export function isTargetNavigable(
  target: ValidationTarget | null
): target is Exclude<ValidationTarget, { kind: 'DOCUMENT' }> {
  return target != null && target.kind !== 'DOCUMENT'
}
