import { useCallback, useEffect, useRef } from 'react'

import type { ViewNode } from '../../types/view'
import { useSduiDispatch } from '../dispatch'
import { useBindingValue } from '../sdui-session-context'

/**
 * Серверная реакция на активацию строки ТЧ (`table.rowActivate`, ADR-0013 §4.4).
 *
 * Выбор строки master живёт на клиенте (презентационный master-detail-фильтр),
 * поэтому правило, зависящее от ТЕКУЩЕЙ строки (аналог `ПриАктивизацииСтроки`),
 * выразить нечем: доменное знание — на сервере. Фронт лишь сообщает, какая строка
 * активна, и применяет пришедшие патчи; сам правило не считает.
 *
 * Команда приходит от бэка готовой строкой — не конструируем и не разбираем её.
 * Нет action с `trigger: 'activate'` — нет round-trip: клик по строке остаётся
 * чисто клиентским, как у всех остальных ТЧ.
 */
export function useRowActivate(node: ViewNode): (rowId: string) => void {
  const dispatch = useSduiDispatch()

  const action = node.actions?.find((a) => a.trigger === 'activate')
  const command = action?.command
  const behavior = action?.behavior

  // Дедуп по rowId: клик по строке — самая частая операция в таблице, а ответ на
  // повторную активацию той же строки идентичен. Без дедупа каждый клик и каждый
  // ре-рендер с тем же выбором молотили бы запросы.
  const lastActivatedRef = useRef<string | null>(null)

  // Новый массив строк по binding таблицы — прежний rowId мог исчезнуть,
  // поэтому дедуп снимаем.
  const canonRows = useBindingValue(node.binding)
  useEffect(() => {
    lastActivatedRef.current = null
  }, [canonRows])

  return useCallback(
    (rowId: string) => {
      if (!command) return
      if (lastActivatedRef.current === rowId) return
      lastActivatedRef.current = rowId

      // behavior приходит с бэка (все три false): команда немутирующая, ревизию
      // не поднимает — клик по строке не должен стоить flush'а незакоммиченного ввода.
      void dispatch({ type: 'COMMAND', command, value: { rowId } }, behavior)
    },
    [command, behavior, dispatch],
  )
}
