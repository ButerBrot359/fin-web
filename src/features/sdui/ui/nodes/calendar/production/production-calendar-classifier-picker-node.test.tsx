import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../../types/view'

const { api, removePanel } = vi.hoisted(() => ({
  api: {
    open: vi.fn(),
    status: vi.fn(),
    select: vi.fn(),
    unselect: vi.fn(),
    apply: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
  },
  removePanel: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ru' } }),
  // Транзитивно нужен @/app/config/i18n (тянется из @/shared/api/api)
  initReactI18next: { type: '3rdParty', init: () => undefined },
}))
vi.mock('../../../../lib/stores/panel-store', () => ({
  usePanelStore: { getState: () => ({ remove: removePanel }) },
}))
vi.mock('../../../../api/production-calendar-classifier', async (orig) => {
  // Реальная schema + подменённый api
  const actual = await orig<Record<string, unknown>>()
  return { ...actual, productionCalendarClassifierApi: api }
})
vi.mock('@/shared/ui/inputs', () => ({
  SearchInput: ({
    value,
    onChange,
  }: {
    value?: string
    onChange?: (e: { target: { value: string } }) => void
  }) => (
    <input
      aria-label="search"
      value={value ?? ''}
      onChange={(e) => onChange?.(e)}
    />
  ),
}))

import { ProductionCalendarClassifierPickerNode } from './production-calendar-classifier-picker-node'

const UUID = '66666666-6666-6666-6666-666666666666'

const pickerView = (over: Record<string, unknown> = {}) => ({
  draftId: UUID,
  draftVersion: 0,
  status: 'OPEN',
  selectedCodes: [] as string[],
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
      {
        code: '02',
        description: 'Шестидневная рабочая неделя',
        baseCode: null,
        existingEntryId: null,
        baseEntryId: null,
        existing: false,
        requiresBaseCreation: false,
      },
    ],
  },
  ...over,
})

const node = (over: Record<string, unknown> = {}): ViewNode =>
  ({
    id: `dialog.productionCalendar.classifierPicker.${UUID}`,
    type: 'PRODUCTION_CALENDAR_CLASSIFIER_PICKER',
    props: {
      presentation: 'modal',
      title: 'Подбор производственных календарей',
      formSessionId: 'fs-1',
      pickerView: pickerView(),
      ...over,
    },
  }) as ViewNode

const renderNode = (n: ViewNode = node(), strict = false) => {
  const queryClient = new QueryClient()
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const content = (
    <QueryClientProvider client={queryClient}>
      <ProductionCalendarClassifierPickerNode node={n} />
    </QueryClientProvider>
  )
  const utils = render(strict ? <StrictMode>{content}</StrictMode> : content)
  return { ...utils, invalidateSpy }
}

const flushMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('ProductionCalendarClassifierPickerNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.cancel.mockResolvedValue(undefined)
  })
  afterEach(cleanup)

  it('рендерит версию, строки каталога и disabled Выбрать при пустом selection', () => {
    renderNode()
    expect(
      screen.getByText('sdui.productionCalendar.classifier.version')
    ).toBeTruthy()
    expect(screen.getByText('Пятидневная рабочая неделя')).toBeTruthy()
    expect(
      screen
        .getByRole('button', {
          name: 'sdui.productionCalendar.classifier.apply',
        })
        .hasAttribute('disabled')
    ).toBe(true)
  })

  it('select шлёт CAS-версию и заменяет snapshot целиком', async () => {
    api.select.mockResolvedValue(
      pickerView({ draftVersion: 1, selectedCodes: ['01'] })
    )
    renderNode()
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    await waitFor(() => {
      expect(api.select).toHaveBeenCalledWith({
        draftId: UUID,
        formSessionId: 'fs-1',
        expectedDraftVersion: 0,
        calendarCode: '01',
      })
    })
    await waitFor(() => {
      expect(
        (screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked
      ).toBe(true)
    })
  })

  it('apply SUCCEEDED → invalidate sdui-list и закрытие панели', async () => {
    api.apply.mockResolvedValue({
      requestId: UUID,
      status: 'SUCCEEDED',
      stages: [],
    })
    const { invalidateSpy } = renderNode(
      node({ pickerView: pickerView({ selectedCodes: ['01'] }) })
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'sdui.productionCalendar.classifier.apply',
      })
    )
    await waitFor(() => {
      expect(api.apply).toHaveBeenCalledWith(
        expect.objectContaining({ draftId: UUID, expectedDraftVersion: 0 })
      )
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sdui-list'] })
      expect(removePanel).toHaveBeenCalled()
    })
    // requestId — UUID
    const req = (api.apply.mock.calls[0] as [{ requestId: string }])[0]
    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('apply FAILED → terminal result, Закрыть без cancel, мутации disabled', async () => {
    api.apply.mockResolvedValue({
      requestId: UUID,
      status: 'FAILED',
      stages: [
        {
          sequenceNumber: 1,
          stageKind: 'DAY_ROWS',
          calendarCode: '01',
          calendarYear: 2030,
          status: 'FAILED',
          errorCode: 'X',
          errorMessage: 'ошибка строк',
        },
      ],
    })
    const { invalidateSpy } = renderNode(
      node({ pickerView: pickerView({ selectedCodes: ['01'] }) })
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'sdui.productionCalendar.classifier.apply',
      })
    )
    await waitFor(() => {
      expect(
        screen.getByText('sdui.productionCalendar.classifier.applyFailed')
      ).toBeTruthy()
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sdui-list'] })
    expect(removePanel).not.toHaveBeenCalled()
    expect(
      (screen.getAllByRole('checkbox')[0] as HTMLInputElement).disabled
    ).toBe(true)
    // «Отмена» заменена на «Закрыть», клик НЕ отменяет terminal draft
    fireEvent.click(
      screen.getByRole('button', { name: 'sdui.productionCalendar.close' })
    )
    await waitFor(() => {
      expect(removePanel).toHaveBeenCalled()
    })
    expect(api.cancel).not.toHaveBeenCalled()
  })

  it('Отмена при OPEN → /cancel, затем закрытие', async () => {
    renderNode()
    fireEvent.click(
      screen.getByRole('button', { name: 'sdui.productionCalendar.cancel' })
    )
    await waitFor(() => {
      expect(api.cancel).toHaveBeenCalledWith({
        draftId: UUID,
        formSessionId: 'fs-1',
        expectedDraftVersion: 0,
      })
      expect(removePanel).toHaveBeenCalled()
    })
  })

  it('StrictMode mount rehearsal НЕ отменяет draft', async () => {
    renderNode(node(), true)
    await flushMicrotasks()
    expect(api.cancel).not.toHaveBeenCalled()
  })

  it('реальный unmount открытого draft → best-effort cancel', async () => {
    const { unmount } = renderNode(node(), true)
    await flushMicrotasks()
    unmount()
    await flushMicrotasks()
    expect(api.cancel).toHaveBeenCalledTimes(1)
  })

  it('невалидный pickerView → error alert без мутаций', () => {
    renderNode(node({ pickerView: {} }))
    expect(
      screen.getByText('sdui.productionCalendar.classifier.invalidWire')
    ).toBeTruthy()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('поиск фильтрует по коду и наименованию', () => {
    renderNode()
    fireEvent.change(screen.getByLabelText('search'), {
      target: { value: 'шести' },
    })
    expect(screen.queryByText('Пятидневная рабочая неделя')).toBeNull()
    expect(screen.getByText('Шестидневная рабочая неделя')).toBeTruthy()
  })
})
