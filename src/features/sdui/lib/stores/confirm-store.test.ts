import { describe, expect, it } from 'vitest'

import { useConfirmStore } from './confirm-store'

describe('confirm-store', () => {
  it('ask открывает диалог и резолвится ответом true', async () => {
    const promise = useConfirmStore.getState().ask('Перейти без сохранения?')
    expect(useConfirmStore.getState().open).toBe(true)
    expect(useConfirmStore.getState().message).toBe('Перейти без сохранения?')

    useConfirmStore.getState().answer(true)
    await expect(promise).resolves.toBe(true)
    expect(useConfirmStore.getState().open).toBe(false)
  })

  it('answer(false) резолвит отказом', async () => {
    const promise = useConfirmStore.getState().ask('m')
    useConfirmStore.getState().answer(false)
    await expect(promise).resolves.toBe(false)
  })

  it('повторный ask после ответа работает (стор переиспользуемый)', async () => {
    const p1 = useConfirmStore.getState().ask('первый')
    useConfirmStore.getState().answer(true)
    await p1
    const p2 = useConfirmStore.getState().ask('второй')
    expect(useConfirmStore.getState().message).toBe('второй')
    useConfirmStore.getState().answer(false)
    await expect(p2).resolves.toBe(false)
  })
})
