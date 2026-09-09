import type { ValidationMessage } from '@/entities/validation-report'

import { targetBinding } from './target-binding'

/**
 * Поиск DOM-якоря цели сообщения В ГРАНИЦАХ экрана (v2 §7: порталы диалогов
 * рендерят те же узлы — глобальный поиск уводит подсказку в диалог).
 *
 * Для TABLE_CELL сперва ищется сама ячейка (строка — по ЛОГИЧЕСКОМУ номеру
 * data-sdui-row-index, не по позиции в разметке); строка вне окна
 * виртуализации — легальная деградация до таблицы.
 */
export function findTargetAnchor(
  scope: ParentNode,
  message: ValidationMessage
): Element | null {
  const binding = targetBinding(message)
  if (!binding) return null
  const container = scope.querySelector(
    `[data-sdui-anchor="${CSS.escape(binding)}"]`
  )
  if (!container) return null

  const t = message.target
  if (t?.kind === 'TABLE_CELL') {
    const cell = container.querySelector(
      `[data-sdui-row-index="${String(t.rowIndex)}"] [data-sdui-col="${CSS.escape(t.columnCode)}"]`
    )
    if (cell) return firstBoxedElement(cell)
  }
  return firstBoxedElement(container)
}

/**
 * Обёртка якоря — display:contents с нулевым прямоугольником (v2 §7):
 * позиционирование по ней улетает в угол экрана. Спускаемся к первому
 * потомку с ненулевой коробкой.
 */
export function firstBoxedElement(el: Element): Element | null {
  const rect = el.getBoundingClientRect()
  if (rect.width > 0 || rect.height > 0) return el
  for (const child of Array.from(el.children)) {
    const boxed = firstBoxedElement(child)
    if (boxed) return boxed
  }
  return null
}
