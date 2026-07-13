import { beforeEach, describe, expect, it, vi } from 'vitest'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewResponse } from '../types/view'
import { fetchMovementsView } from '../api/movements-api'
import { openDialogAsPanel } from './open-dialog-panel'
import { openMovementsForEntry } from './open-movements'

vi.mock('../api/movements-api', () => ({ fetchMovementsView: vi.fn() }))
vi.mock('./open-dialog-panel', () => ({ openDialogAsPanel: vi.fn() }))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))

const mockFetch = vi.mocked(fetchMovementsView)

const makeResponse = (effects: ViewResponse['effects']): ViewResponse => ({
  formSessionId: '',
  revision: 0,
  effects,
})

describe('openMovementsForEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('openDialog-эффект уходит в openDialogAsPanel без parentSessionId', async () => {
    const effect = {
      type: 'openDialog' as const,
      node: { id: 'dialog.movements', type: 'PAGE' as const },
    }
    mockFetch.mockResolvedValue(makeResponse([effect]))

    await openMovementsForEntry('123')

    expect(mockFetch).toHaveBeenCalledWith('123')
    expect(openDialogAsPanel).toHaveBeenCalledWith(effect)
    expect(showToast).not.toHaveBeenCalled()
  })

  it('notify-эффект показывает toast и не открывает панель', async () => {
    mockFetch.mockResolvedValue(
      makeResponse([
        { type: 'notify' as const, level: 'warning', message: 'Нет движений' },
      ]),
    )

    await openMovementsForEntry('123')

    expect(showToast).toHaveBeenCalledWith('warning', 'Нет движений')
    expect(openDialogAsPanel).not.toHaveBeenCalled()
  })

  it('пустые effects — ничего не делает', async () => {
    mockFetch.mockResolvedValue(makeResponse(undefined))

    await openMovementsForEntry('123')

    expect(openDialogAsPanel).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })
})
