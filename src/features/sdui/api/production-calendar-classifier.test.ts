import { beforeEach, describe, expect, it, vi } from 'vitest'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@/shared/api/api', () => ({ apiService: { post } }))

import {
  classifierPickerViewSchema,
  productionCalendarClassifierApi,
} from './production-calendar-classifier'

const UUID = '66666666-6666-6666-6666-666666666666'

const pickerView = (over: Record<string, unknown> = {}) => ({
  draftId: UUID,
  draftVersion: 0,
  status: 'OPEN',
  selectedCodes: [],
  catalog: {
    artifactId: 701,
    classifierId: 'Calendars20',
    classifierVersion: 46,
    sourceKind: 'EMBEDDED',
    listSource: 'SELECTED_ARTIFACT',
    rawSha256: '0'.repeat(64),
    selectionVersion: 3,
    calendars: [
      {
        code: '01',
        description: 'Пятидневная рабочая неделя',
        baseCode: null,
        existingEntryId: 101,
        baseEntryId: null,
        existing: true,
        requiresBaseCreation: false,
      },
    ],
  },
  ...over,
})

const envelope = (data: unknown) => ({ data: { success: true, data } })

const versioned = {
  draftId: UUID,
  formSessionId: 'fs-1',
  expectedDraftVersion: 2,
}

describe('productionCalendarClassifierApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('open: POST /open, извлекает data.data и валидирует schema', async () => {
    post.mockResolvedValue(envelope(pickerView()))
    const view = await productionCalendarClassifierApi.open('fs-1')
    expect(post).toHaveBeenCalledWith({
      url: '/api/view/production-calendar/classifier-picker/open',
      data: { formSessionId: 'fs-1' },
    })
    expect(view.draftId).toBe(UUID)
    expect(view.catalog.calendars).toHaveLength(1)
  })

  it('select: versioned request + calendarCode', async () => {
    post.mockResolvedValue(envelope(pickerView({ selectedCodes: ['01'] })))
    const view = await productionCalendarClassifierApi.select({
      ...versioned,
      calendarCode: '01',
    })
    expect(post).toHaveBeenCalledWith({
      url: '/api/view/production-calendar/classifier-picker/select',
      data: { ...versioned, calendarCode: '01' },
    })
    expect(view.selectedCodes).toEqual(['01'])
  })

  it('apply: возвращает валидированный ApplyResult', async () => {
    post.mockResolvedValue(
      envelope({
        requestId: UUID,
        status: 'PARTIAL_FAILED',
        stages: [
          {
            sequenceNumber: 1,
            stageKind: 'LIST',
            calendarCode: null,
            calendarYear: null,
            status: 'SUCCEEDED',
            errorCode: null,
            errorMessage: null,
          },
        ],
      })
    )
    const result = await productionCalendarClassifierApi.apply({
      ...versioned,
      requestId: UUID,
    })
    expect(result.status).toBe('PARTIAL_FAILED')
    expect(result.stages[0].stageKind).toBe('LIST')
  })

  it('невалидный провод (кривой sha256) → throw', async () => {
    post.mockResolvedValue(envelope(pickerView({ catalog: undefined })))
    await expect(productionCalendarClassifierApi.open('fs-1')).rejects.toThrow()
  })

  it('cancel: POST без валидации тела (204)', async () => {
    post.mockResolvedValue({ data: undefined })
    await productionCalendarClassifierApi.cancel(versioned)
    expect(post).toHaveBeenCalledWith({
      url: '/api/view/production-calendar/classifier-picker/cancel',
      data: { ...versioned },
    })
  })

  it('schema: rawSha256 не 64 hex → invalid', () => {
    expect(
      classifierPickerViewSchema.safeParse(
        pickerView({
          catalog: { ...pickerView().catalog, rawSha256: 'xyz' },
        })
      ).success
    ).toBe(false)
  })

  it('schema: отрицательная draftVersion → invalid', () => {
    expect(
      classifierPickerViewSchema.safeParse(pickerView({ draftVersion: -1 }))
        .success
    ).toBe(false)
  })
})
