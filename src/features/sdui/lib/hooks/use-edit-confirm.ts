import { useRef } from 'react'

import { useConfirmStore } from '../stores/confirm-store'

/**
 * Подтверждение перед первой правкой поля (`props.editConfirm`) — порт вопроса БСП 1С
 * «Номер заполняется автоматически при записи. Продолжить редактирование?».
 *
 * Вопрос задаётся ОДИН раз на монтирование поля: в 1С он тоже не повторяется, пока
 * пользователь остаётся в поле. «Нет» — снимаем фокус, поле остаётся нетронутым.
 */
export function useEditConfirm(message: string | undefined): {
  onFocus: (event: { currentTarget: { blur: () => void } }) => void
} {
  const asked = useRef(false)
  const ask = useConfirmStore((s) => s.ask)

  return {
    onFocus: (event) => {
      if (!message || asked.current) return
      asked.current = true
      const target = event.currentTarget
      void ask(message).then((ok) => {
        if (!ok) target.blur()
      })
    },
  }
}
