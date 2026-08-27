import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { applyValuePatches } from '../../../../lib/patch-applier'
import { useViewStateStore } from '../../../../lib/stores/view-state-store'
import { parseTabelMatrixPayload } from './tabel-matrix-contract'
import { validPayload } from './tabel-matrix-contract.test'
import { useTabelMatrixQueue } from './tabel-matrix-queue'

// SCRUM-276 spec v6: snapshot матрицы приходит setValue-патчем в ответе ЛЮБОГО
// изменения состояния (field-event периода, save, post, unpost), не только
// matrix-команд. Тест гоняет РЕАЛЬНУЮ цепочку applyValuePatches →
// view-state-store → очередь (session-фолбэк на глобальных сторах);
// мокается только transport.
const dispatched: Record<string, unknown>[] = []

vi.mock('../../../../lib/dispatch', () => ({
  useSduiDispatch: () => (action: { value: Record<string, unknown> }) => {
    dispatched.push(action.value)
    return Promise.resolve(true)
  },
}))

const BINDING = 'tabel.matrix'

/** Snapshot следующей generation: сотрудник 42 исчез, вместо него 77. */
const nextSnapshot = {
  ...validPayload,
  generation: 21,
  employees: [
    {
      employeeNodeId: 'employee:77',
      employeeRef: 77,
      employeePresentation: 'Петров П. П.',
      dayTotals: {},
      total: '',
      workKinds: [
        {
          kindNodeId: 'employee:77:kind:101',
          workTimeKindRef: 101,
          workTimeKindPresentation: 'Явка',
          protected: false,
          protectionCode: null,
          cells: {},
          total: '',
        },
      ],
    },
  ],
}

/** Патч в форме серверного ответа на НЕ-матричное событие (v6 §API). */
const matrixPatch = {
  op: 'setValue' as const,
  binding: BINDING,
  value: nextSnapshot,
}

describe('setValue(tabel.matrix): полная замена payload/generation (spec v6)', () => {
  beforeEach(() => {
    dispatched.length = 0
    useViewStateStore.getState().replaceAll({ [BINDING]: { ...validPayload } })
  })

  it('патч заменяет payload целиком: employees не мержатся, generation — серверная', () => {
    applyValuePatches([matrixPatch], useViewStateStore.getState().setFromServer)

    const stored = parseTabelMatrixPayload(
      useViewStateStore.getState().state[BINDING]
    )
    expect(stored).not.toBeNull()
    expect(stored?.generation).toBe(21)
    // Полный snapshot, не delta: прежний сотрудник 42 исчез, есть только 77
    expect(stored?.employees.map((e) => e.employeeRef)).toEqual([77])
  })

  it('патч применяется по binding без белого списка событий-источников', () => {
    // Соседний setValue чужого binding не трогает матрицу…
    applyValuePatches(
      [{ op: 'setValue', binding: 'header.nomer', value: '77' }],
      useViewStateStore.getState().setFromServer
    )
    expect(
      parseTabelMatrixPayload(useViewStateStore.getState().state[BINDING])
        ?.generation
    ).toBe(17)

    // …а матричный — применяется, из какого бы ответа ни пришёл
    applyValuePatches(
      [{ op: 'setValue', binding: 'header.nomer', value: '78' }, matrixPatch],
      useViewStateStore.getState().setFromServer
    )
    expect(
      parseTabelMatrixPayload(useViewStateStore.getState().state[BINDING])
        ?.generation
    ).toBe(21)
  })

  it('команда, поставленная в очередь ДО патча, уходит с новой generation', async () => {
    const { result } = renderHook(() =>
      useTabelMatrixQueue('table.uchetRabochegoVremeni', BINDING)
    )

    // Порядок как в жизни: пользователь сменил период (ответ с патчем ещё в
    // пути) и сразу жмёт «Добавить» — билдер обязан прочитать generation,
    // которую патч запишет к моменту отправки.
    applyValuePatches([matrixPatch], useViewStateStore.getState().setFromServer)
    const ok = await result.current.enqueue(() => ({
      type: 'ADD_EMPLOYEE',
      employeeRef: 99,
    }))

    expect(ok).toBe(true)
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0].baseGeneration).toBe(21)
  })
})
