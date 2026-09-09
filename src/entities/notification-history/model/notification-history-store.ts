import { create } from 'zustand'

// SCRUM-317 канал №8: центр оповещений копит то, что приезжает всплывашками,
// за текущий сеанс вкладки (без персиста — после F5 история пуста, как и
// панель ошибок). Ссылка notify.route сохраняется: всплывашка гаснет за
// секунды, переход должен остаться доступен (v2 §4.1).
export interface NotificationRecord {
  id: number
  level: 'success' | 'error' | 'info' | 'warning'
  title: string
  description?: string
  /** Готовый маршрут фронта из notify.route; null — некликабельная запись. */
  route: string | null
  /** Момент показа (epoch ms). */
  at: number
}

const HISTORY_LIMIT = 100

interface NotificationHistoryState {
  records: NotificationRecord[]
  unread: number
  add: (record: Omit<NotificationRecord, 'id'>) => void
  markAllRead: () => void
  clear: () => void
}

let nextId = 1

export const useNotificationHistoryStore = create<NotificationHistoryState>(
  (set) => ({
    records: [],
    unread: 0,

    add: (record) => {
      set((s) => ({
        records: [{ ...record, id: nextId++ }, ...s.records].slice(
          0,
          HISTORY_LIMIT
        ),
        unread: s.unread + 1,
      }))
    },

    markAllRead: () => {
      set({ unread: 0 })
    },

    clear: () => {
      set({ records: [], unread: 0 })
    },
  })
)
