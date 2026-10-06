import { create } from 'zustand'

/**
 * Состояние отказа SDUI-экрана по маршрутному ключу вкладки (tabRouteKey) —
 * SCRUM-400 §5.2/§9.5.
 *
 * Стор, а не колбэк хоста: 403/404 приходят не только из первого OPEN
 * (переоткрытие после смены языка, повторный OPEN после отзыва прав), а хостов
 * у SDUI-экрана несколько (catch-all, module-page, universal-domain, дровер).
 * Рисует состояние сам SduiScreen — хостам ничего передавать не нужно, и
 * «вечный скелетон» (дефект F8) невозможен ни в одном из них.
 */
export type ScreenAccessState =
  | { kind: 'denied'; message: string | null }
  | { kind: 'not-found' }

interface ScreenAccessStoreState {
  byRoute: Record<string, ScreenAccessState>
  setDenied: (route: string, message: string | null) => void
  setNotFound: (route: string) => void
  /** Успешный OPEN и закрытие вкладки снимают состояние. */
  clear: (route: string) => void
  /** Смена пользователя: отказы прежнего не относятся к новому. */
  clearAll: () => void
}

export const useScreenAccessStore = create<ScreenAccessStoreState>((set) => ({
  byRoute: {},
  setDenied: (route, message) => {
    set((s) => ({
      byRoute: { ...s.byRoute, [route]: { kind: 'denied', message } },
    }))
  },
  setNotFound: (route) => {
    set((s) => ({
      byRoute: { ...s.byRoute, [route]: { kind: 'not-found' } },
    }))
  },
  clear: (route) => {
    set((s) => {
      if (!(route in s.byRoute)) return s
      const { [route]: _removed, ...rest } = s.byRoute
      return { byRoute: rest }
    })
  },
  clearAll: () => {
    set({ byRoute: {} })
  },
}))
