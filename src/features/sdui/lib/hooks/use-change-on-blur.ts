import { useEffect, useRef } from 'react'

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
interface FocusedField {
  isChanged: () => boolean
  flush: () => void
}

let focusedField: FocusedField | null = null

export function hasPendingFieldChange(): boolean {
  return focusedField?.isChanged() ?? false
}

export function flushPendingFieldChange(): void {
  focusedField?.flush()
}

export function useChangeOnBlur(
  f: Pick<FieldNodeCommon, 'fireServerEvent'>,
  value: unknown
): { onFocus: () => void; onBlur: () => void } {
  const focusValue = useRef(value)
  const latest = useRef({ f, value })
  const field = useRef<FocusedField | null>(null)

  useEffect(() => {
    latest.current = { f, value }
  })

  useEffect(
    () => () => {
      if (focusedField !== null && focusedField === field.current) {
        focusedField = null
      }
    },
    []
  )

  const sendIfChanged = (
    current: unknown,
    fire: FieldNodeCommon['fireServerEvent']
  ) => {
    if (Object.is(current, focusValue.current)) return
    focusValue.current = current
    fire('change', current)
  }

  return {
    onFocus: () => {
      focusValue.current = value
      const entry: FocusedField = {
        isChanged: () => !Object.is(latest.current.value, focusValue.current),
        flush: () => {
          sendIfChanged(latest.current.value, latest.current.f.fireServerEvent)
        },
      }
      field.current = entry
      focusedField = entry
    },
    onBlur: () => {
      if (focusedField === field.current) focusedField = null
      sendIfChanged(value, f.fireServerEvent)
    },
  }
}
