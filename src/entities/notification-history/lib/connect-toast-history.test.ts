import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { showToast } from '@/shared/ui/toast/show-toast'

import { useNotificationHistoryStore } from '../model/notification-history-store'

import { connectToastHistory } from './connect-toast-history'

vi.mock('sonner', () => ({ toast: { custom: vi.fn() } }))

describe('connect-toast-history', () => {
  let disconnect: () => void

  beforeEach(() => {
    useNotificationHistoryStore.setState({ records: [], unread: 0 })
    disconnect = connectToastHistory()
  })

  afterEach(() => {
    disconnect()
  })

  it('успешные операции в историю не попадают', () => {
    showToast('success', 'Документ проведён')
    showToast('success', 'Заполнено сотрудников: 37.')
    showToast('info', 'Расчёт запущен')
    const state = useNotificationHistoryStore.getState()
    expect(state.records).toEqual([])
    expect(state.unread).toBe(0)
  })

  it('ошибки и предупреждения копятся вместе с описанием и маршрутом', () => {
    showToast(
      'error',
      'Документ изменён другим пользователем',
      'Запись отменена',
      {
        route: '/documents/PrikhodnyyKassovyyOrder/1',
      }
    )
    showToast('warning', 'Проверьте период регистрации')
    const state = useNotificationHistoryStore.getState()
    expect(state.records.map((r) => r.title)).toEqual([
      'Проверьте период регистрации',
      'Документ изменён другим пользователем',
    ])
    expect(state.records[1].description).toBe('Запись отменена')
    expect(state.records[1].route).toBe('/documents/PrikhodnyyKassovyyOrder/1')
    expect(state.unread).toBe(2)
  })

  it('после отписки не копится ничего', () => {
    disconnect()
    showToast('error', 'ошибка после отписки')
    expect(useNotificationHistoryStore.getState().records).toEqual([])
  })
})
