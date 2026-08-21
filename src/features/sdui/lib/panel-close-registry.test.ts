import { describe, expect, it, vi } from 'vitest'

import {
  registerPanelCloseHandler,
  requestPanelClose,
  unregisterPanelCloseHandler,
} from './panel-close-registry'

describe('реестр серверного закрытия панели', () => {
  it('без обработчика возвращает false — панель закрывает хост, как раньше', () => {
    expect(requestPanelClose('panel-без-команды')).toBe(false)
  })

  it('с обработчиком зовёт его и возвращает true — закрытие уходит серверу', () => {
    const handler = vi.fn()
    registerPanelCloseHandler('panel-1', handler)

    expect(requestPanelClose('panel-1')).toBe(true)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  // Размонтированная панель не должна перехватывать закрытие: иначе крестик
  // соседней панели с тем же id ушёл бы в мёртвую сессию.
  it('после снятия регистрации снова false', () => {
    registerPanelCloseHandler('panel-2', vi.fn())
    unregisterPanelCloseHandler('panel-2')

    expect(requestPanelClose('panel-2')).toBe(false)
  })
})
