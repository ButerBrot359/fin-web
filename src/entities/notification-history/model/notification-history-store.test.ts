import { beforeEach, describe, expect, it } from 'vitest'

import { useNotificationHistoryStore } from './notification-history-store'

describe('notification-history-store', () => {
  beforeEach(() => {
    useNotificationHistoryStore.setState({ records: [], unread: 0 })
  })

  it('копит записи новыми сверху и считает непрочитанные', () => {
    const s = useNotificationHistoryStore.getState()
    s.add({ level: 'info', title: 'первое', route: null, at: 1 })
    s.add({
      level: 'success',
      title: 'Запись создана: Иванов И.',
      route: '/dictionaries/FizicheskieLitsa/42',
      at: 2,
    })
    const state = useNotificationHistoryStore.getState()
    expect(state.records[0].title).toBe('Запись создана: Иванов И.')
    expect(state.records[0].route).toBe('/dictionaries/FizicheskieLitsa/42')
    expect(state.unread).toBe(2)
  })

  it('markAllRead гасит бейдж, clear очищает историю', () => {
    const s = useNotificationHistoryStore.getState()
    s.add({ level: 'error', title: 'ошибка', route: null, at: 1 })
    s.markAllRead()
    expect(useNotificationHistoryStore.getState().unread).toBe(0)
    s.clear()
    expect(useNotificationHistoryStore.getState().records).toEqual([])
  })

  it('история ограничена сотней записей', () => {
    const s = useNotificationHistoryStore.getState()
    for (let i = 0; i < 120; i++) {
      s.add({ level: 'info', title: `t${String(i)}`, route: null, at: i })
    }
    expect(useNotificationHistoryStore.getState().records).toHaveLength(100)
    expect(useNotificationHistoryStore.getState().records[0].title).toBe('t119')
  })
})
