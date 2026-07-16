import { useCallback, useEffect, useRef } from 'react'
import type { UIEvent } from 'react'

/**
 * Позиция прокрутки по ключу (in-memory, переживает навигацию в SPA; сбрасывается
 * на полной перезагрузке). Ключ — «маршрут документа + код ТЧ».
 */
const scrollStore = new Map<string, { left: number; top: number }>()

/**
 * Запоминает позицию прокрутки контейнера (ТЧ документа) и восстанавливает её при
 * повторном маунте (возврат к документу через историю/workspace-табы ремаунтит
 * форму → таблица иначе прыгает в начало). `setRef` вешать на скролл-контейнер,
 * `onScroll` — на его `onScroll`.
 */
export const usePersistedScroll = (key: string) => {
  const restoredRef = useRef(false)

  // Новый ключ (другой документ/ТЧ) → разрешаем восстановление заново.
  useEffect(() => {
    restoredRef.current = false
  }, [key])

  const setRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el || restoredRef.current) return
      const saved = scrollStore.get(key)
      if (saved) {
        el.scrollLeft = saved.left
        el.scrollTop = saved.top
      }
      restoredRef.current = true
    },
    [key]
  )

  const onScroll = useCallback(
    (e: UIEvent<HTMLElement>) => {
      const el = e.currentTarget
      scrollStore.set(key, { left: el.scrollLeft, top: el.scrollTop })
    },
    [key]
  )

  return { setRef, onScroll }
}
