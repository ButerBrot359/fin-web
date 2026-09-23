import { describe, expect, it } from 'vitest'

import { acquireFormTurn } from './form-dispatch-queue'

describe('acquireFormTurn (SCRUM-308 v1 §5, FIFO на formSessionId)', () => {
  it('без сессии хода нет — release мгновенный', async () => {
    const release = await acquireFormTurn(null)
    expect(typeof release).toBe('function')
    release()
  })

  it('второй запрос сессии ждёт release первого', async () => {
    const releaseA = await acquireFormTurn('fs-1')
    let bStarted = false
    const turnB = acquireFormTurn('fs-1').then((r) => {
      bStarted = true
      return r
    })
    // Микротаски дренируем — B не должен стартовать, пока A держит ход
    await Promise.resolve()
    await Promise.resolve()
    expect(bStarted).toBe(false)
    releaseA()
    const releaseB = await turnB
    expect(bStarted).toBe(true)
    releaseB()
  })

  it('порядок строго FIFO', async () => {
    const order: number[] = []
    const releaseA = await acquireFormTurn('fs-2')
    const b = acquireFormTurn('fs-2').then((r) => {
      order.push(2)
      return r
    })
    const c = acquireFormTurn('fs-2').then((r) => {
      order.push(3)
      return r
    })
    order.push(1)
    releaseA()
    const releaseB = await b
    releaseB()
    const releaseC = await c
    releaseC()
    expect(order).toEqual([1, 2, 3])
  })

  it('разные сессии не блокируют друг друга', async () => {
    const releaseA = await acquireFormTurn('fs-3')
    // Другая сессия получает ход сразу, не дожидаясь fs-3
    const releaseOther = await acquireFormTurn('fs-4')
    releaseOther()
    releaseA()
  })
})
