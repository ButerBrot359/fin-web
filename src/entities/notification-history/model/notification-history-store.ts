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
  /**
   * Сколько раз подряд пришла та же всплывашка. Повторы одного и того же
   * сообщения (например, четыре попытки записи с «Документ изменён другим
   * пользователем») склеиваются в одну строку со счётчиком, а не множат историю.
   */
  count?: number
}

const HISTORY_LIMIT = 100

interface NotificationHistoryState {
  records: NotificationRecord[]
  unread: number
  add: (record: Omit<NotificationRecord, 'id' | 'count'>) => void
  markAllRead: () => void
  clear: () => void
}

let nextId = 1

function isSameMessage(
  a: Omit<NotificationRecord, 'id'>,
  b: Omit<NotificationRecord, 'id' | 'count'>
): boolean {
  return (
    a.level === b.level &&
    a.title === b.title &&
    (a.description ?? null) === (b.description ?? null) &&
    a.route === b.route
  )
}

export const useNotificationHistoryStore = create<NotificationHistoryState>(
  (set) => ({
    records: [],
    unread: 0,

    add: (record) => {
      set((s) => {
        const last = s.records.at(0)
        if (last && isSameMessage(last, record)) {
          return {
            records: [
              { ...last, at: record.at, count: (last.count ?? 1) + 1 },
              ...s.records.slice(1),
            ],
            unread: s.unread + 1,
          }
        }
        return {
          records: [{ ...record, id: nextId++, count: 1 }, ...s.records].slice(
            0,
            HISTORY_LIMIT
          ),
          unread: s.unread + 1,
        }
      })
    },

    markAllRead: () => {
      set({ unread: 0 })
    },

    clear: () => {
      set({ records: [], unread: 0 })
    },
  })
)
