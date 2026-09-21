import { describe, expect, it, vi } from 'vitest'

import { notifyFieldEdited, registerFieldEditHandler } from './field-edit-bus'

describe('field-edit-bus (SCRUM-317 v4 §4.4 шаг 3)', () => {
  it('уведомляет подписчиков и перестаёт после отписки', () => {
    const handler = vi.fn()
    const unregister = registerFieldEditHandler(handler)

    notifyFieldEdited('DataS')
    expect(handler).toHaveBeenCalledWith('DataS')

    unregister()
    notifyFieldEdited('DataPo')
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
