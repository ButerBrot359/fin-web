import { useRef } from 'react'

import type { FieldNodeCommon } from './use-field-node'

/**
 * Гард против лишних `change`-EVENT'ов на текстовых полях (SCRUM-217, просьба №1).
 *
 * `TEXT_FIELD` / `TEXT_AREA` / `NUMBER_FIELD` шлют `change` на blur. После серверного
 * `setValue` (автозаполнение) следующий blur пользователя без правки давал бы лишний
 * EVENT (+revision, лишний круг пересчёта, повторный разбор ФИО).
 *
 * Решение: запоминаем значение на `onFocus` и шлём `change` на `onBlur` только если
 * значение реально изменилось за сессию фокуса. Сравнение по значению-на-фокусе (а не
 * по «последнему отправленному»), т.к. серверный setValue идёт мимо fireServerEvent.
 */
export function useChangeOnBlur(
  f: Pick<FieldNodeCommon, 'fireServerEvent'>,
  value: unknown,
): { onFocus: () => void; onBlur: () => void } {
  const focusValue = useRef(value)
  return {
    onFocus: () => {
      focusValue.current = value
    },
    onBlur: () => {
      if (!Object.is(value, focusValue.current)) {
        f.fireServerEvent('change', value)
      }
    },
  }
}
