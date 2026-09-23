import { describe, expect, it, vi } from 'vitest'

import type { RecalculationNotice } from '../types/recalculation-notice'
import { showRecalculationNotices } from './show-recalculation-notices'

const showToast = vi.hoisted(() => vi.fn())
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast }))

const notice = (over: Partial<RecalculationNotice>): RecalculationNotice => ({
  kind: 'STALE',
  operation: 'POST',
  dependencyCode: 'raschet-amortizatsii',
  level: 'warning',
  message: 'Пересчитайте амортизацию за сентябрь.',
  targetKind: 'PERESCHITAT',
  route: '/documents/ReglamentnayaOperatsiya/5',
  documentId: 5,
  documentTypeCode: 'ReglamentnayaOperatsiya',
  documentNumber: 'RO-000012',
  documentDate: '2026-09-30',
  totalCount: 1,
  periodFrom: '2026-09-01',
  periodsToRecalculate: ['2026-09-01'],
  affectedDocumentIds: [5],
  ...over,
})

describe('showRecalculationNotices (SCRUM-330, ADR-0079)', () => {
  it('уведомление с route — кликабельный warning-тост, клик ведёт по маршруту', () => {
    showToast.mockClear()
    const navigate = vi.fn()
    showRecalculationNotices([notice({})], navigate)
    expect(showToast).toHaveBeenCalledTimes(1)
    const [level, message, , opts] = showToast.mock.calls[0] as [
      string,
      string,
      unknown,
      { route: string | null; onClick?: () => void },
    ]
    expect(level).toBe('warning')
    expect(message).toBe('Пересчитайте амортизацию за сентябрь.')
    expect(opts.route).toBe('/documents/ReglamentnayaOperatsiya/5')
    opts.onClick?.()
    expect(navigate).toHaveBeenCalledWith(
      '/documents/ReglamentnayaOperatsiya/5'
    )
  })

  it('CHECK_SKIPPED без route — тост некликабельный', () => {
    showToast.mockClear()
    showRecalculationNotices(
      [
        notice({
          kind: 'CHECK_SKIPPED',
          route: null,
          targetKind: null,
          documentId: null,
          message: 'Не удалось проверить, нужен ли пересчёт',
        }),
      ],
      vi.fn()
    )
    const opts = showToast.mock.calls[0][3] as {
      route: string | null
      onClick?: () => void
    }
    expect(opts.route).toBeNull()
    expect(opts.onClick).toBeUndefined()
  })

  it('пустой/отсутствующий список — ни одного тоста (старые ответы без поля)', () => {
    showToast.mockClear()
    showRecalculationNotices([], vi.fn())
    showRecalculationNotices(undefined, vi.fn())
    showRecalculationNotices(null, vi.fn())
    expect(showToast).not.toHaveBeenCalled()
  })

  it('несколько уведомлений — по тосту на каждое, в порядке фасада', () => {
    showToast.mockClear()
    showRecalculationNotices(
      [notice({ message: 'первое' }), notice({ message: 'второе' })],
      vi.fn()
    )
    expect(showToast.mock.calls.map((c) => c[1] as string)).toEqual([
      'первое',
      'второе',
    ])
  })
})
