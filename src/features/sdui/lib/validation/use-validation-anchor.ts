import { useValidationReportStore } from '@/entities/validation-report'

import type { ViewNode } from '../../types/view'
import { targetBinding } from './target-binding'

/**
 * binding узла, если на него указывает хотя бы одно сообщение текущего отчёта
 * экрана — тогда NodeRenderer вешает DOM-якорь (data-sdui-anchor). Вне отчёта
 * возвращает null: в обычной жизни экран рендерится без единой обёртки.
 * Ключ экрана берётся из стора (его ставит SduiScreen), не из роутера —
 * узел дерева о маршрутизации не знает.
 */
export function useValidationAnchorBinding(node: ViewNode): string | null {
  return useValidationReportStore((s) => {
    const binding = node.binding
    if (!binding) return null
    const report = s.screenKey != null ? s.reports[s.screenKey] : undefined
    if (!report) return null
    const hit = report.messages.some((m) => targetBinding(m) === binding)
    return hit ? binding : null
  })
}
