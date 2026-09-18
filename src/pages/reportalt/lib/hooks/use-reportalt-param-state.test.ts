import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchReportAltParamState } from '../../api/reportalt-api'
import type { ReportAltParamStateDto } from '../../types/reportalt'
import { useReportAltParamState } from './use-reportalt-param-state'

vi.mock('../../api/reportalt-api', () => ({
  fetchReportAltParamState: vi.fn(),
}))

const fetchMock = vi.mocked(fetchReportAltParamState)

const state = (
  patch: Partial<ReportAltParamStateDto>
): ReportAltParamStateDto => ({
  values: {},
  disabledParams: [],
  optionsSources: {},
  messages: {},
  ...patch,
})

describe('useReportAltParamState', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('отправляет значения и изменённый параметр и хранит ответ', async () => {
    fetchMock.mockResolvedValue(
      state({
        values: { PokazatelKolichestvo: false },
        disabledParams: ['PokazatelKolichestvo'],
      })
    )
    const { result } = renderHook(() =>
      useReportAltParamState('KartochkaScheta')
    )

    let returned: ReportAltParamStateDto | null = null
    await act(async () => {
      returned = await result.current.refreshParamState({ Schet: 101 }, 'Schet')
    })

    expect(fetchMock).toHaveBeenCalledWith('KartochkaScheta', {
      parameters: { Schet: 101 },
      changedParam: 'Schet',
    })
    expect(returned).toEqual(
      state({
        values: { PokazatelKolichestvo: false },
        disabledParams: ['PokazatelKolichestvo'],
      })
    )
    expect(result.current.paramState.disabledParams).toEqual([
      'PokazatelKolichestvo',
    ])
  })

  it('поздний ответ раннего запроса не перетирает состояние', async () => {
    let resolveFirst: ((value: ReportAltParamStateDto) => void) | undefined
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise<ReportAltParamStateDto>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValueOnce(state({ disabledParams: ['PokazatelBU'] }))
    const { result } = renderHook(() =>
      useReportAltParamState('KartochkaSubkonto')
    )

    let first: Promise<ReportAltParamStateDto | null> = Promise.resolve(null)
    await act(async () => {
      first = result.current.refreshParamState(
        { VidSubkonto: [1] },
        'VidSubkonto'
      )
      await result.current.refreshParamState(
        { VidSubkonto: [1, 2] },
        'VidSubkonto'
      )
    })
    await act(async () => {
      resolveFirst?.(state({ disabledParams: ['PokazatelKolichestvo'] }))
      expect(await first).toBeNull()
    })

    expect(result.current.paramState.disabledParams).toEqual(['PokazatelBU'])
  })

  it('ошибка запроса не ломает форму', async () => {
    fetchMock.mockRejectedValue(new Error('500'))
    const { result } = renderHook(() =>
      useReportAltParamState('KartochkaScheta')
    )

    let returned: ReportAltParamStateDto | null = state({})
    await act(async () => {
      returned = await result.current.refreshParamState({}, null)
    })

    expect(returned).toBeNull()
    expect(result.current.paramState.disabledParams).toEqual([])
  })
})
