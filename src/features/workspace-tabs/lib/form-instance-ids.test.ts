import { beforeEach, describe, expect, it } from 'vitest'

import {
  dropFormInstanceId,
  ensureFormInstanceId,
  moveFormInstanceId,
} from './form-instance-ids'

const TAB = '/documents/Otpusk/new'

// SCRUM-312: инварианты из фронт-спеки formInstanceId (03.09).
describe('form-instance-ids', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('стабилен между обращениями одной вкладки (реопен по 409 — тот же id)', () => {
    const id = ensureFormInstanceId(TAB)
    expect(ensureFormInstanceId(TAB)).toBe(id)
  })

  it('уникален между вкладками', () => {
    expect(ensureFormInstanceId(TAB)).not.toBe(
      ensureFormInstanceId('/documents/Tabel/new')
    )
  })

  it('drop: закрыли вкладку → следующее открытие получает НОВЫЙ id', () => {
    const id = ensureFormInstanceId(TAB)
    dropFormInstanceId(TAB)
    expect(ensureFormInstanceId(TAB)).not.toBe(id)
  })

  it('move: переход new → записанный сохраняет id за вкладкой', () => {
    const id = ensureFormInstanceId(TAB)
    moveFormInstanceId(TAB, '/documents/Otpusk/1042')
    expect(ensureFormInstanceId('/documents/Otpusk/1042')).toBe(id)
    // Старый слот освобождён — новое создание не унаследует id записанного
    expect(ensureFormInstanceId(TAB)).not.toBe(id)
  })

  it('переживает F5: id лежит в sessionStorage', () => {
    const id = ensureFormInstanceId(TAB)
    const raw = sessionStorage.getItem('workspace-tabs.formInstanceIds')
    expect(raw).toContain(id)
  })
})
