import { describe, expect, it } from 'vitest'

import { useUnsavedChangesStore } from './unsaved-changes-store'

describe('unsaved-changes-store', () => {
  it('ask открывает диалог и резолвится ответом пользователя', async () => {
    const promise = useUnsavedChangesStore.getState().ask()
    expect(useUnsavedChangesStore.getState().open).toBe(true)

    useUnsavedChangesStore.getState().answer('save')
    await expect(promise).resolves.toBe('save')
    expect(useUnsavedChangesStore.getState().open).toBe(false)
  })

  it('повторный ask при открытом диалоге резолвит предыдущий промис «Отменой»', async () => {
    const p1 = useUnsavedChangesStore.getState().ask()
    // Второй вопрос до ответа на первый: p1 не должен зависнуть навсегда —
    // прежний вызывающий получает 'cancel' (форма остаётся открытой).
    const p2 = useUnsavedChangesStore.getState().ask()

    await expect(p1).resolves.toBe('cancel')

    useUnsavedChangesStore.getState().answer('discard')
    await expect(p2).resolves.toBe('discard')
    expect(useUnsavedChangesStore.getState().open).toBe(false)
  })
})
