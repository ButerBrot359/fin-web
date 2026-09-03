import type { FC } from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface QueryConfig {
  queryKey: unknown[]
  queryFn: (ctx: {
    pageParam: number
    signal?: AbortSignal
  }) => Promise<unknown>
  initialPageParam: number
  getNextPageParam: (
    last: Record<string, unknown>,
    pages: Record<string, unknown>[]
  ) => number | undefined
  enabled: boolean
}

interface QueryReturn {
  data?: { pages: Record<string, unknown>[] }
  isLoading: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}

interface SettingsPanelStubProps {
  reportCode: string
  appliedUserSettings: unknown
  onApply: (userSettings: unknown) => void
  onReset: () => void
  open: boolean
  onClose: () => void
}

interface GatewayImplStub {
  Renderer: FC<{ result: unknown }>
  print?: (url: string, body: unknown) => Promise<void>
  exportXlsx?: (result: unknown, reportName: string) => void
  SettingsPanel?: FC<SettingsPanelStubProps>
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'ru' },
  }),
}))

const useInfiniteQuery = vi.fn<(cfg: QueryConfig) => QueryReturn>()
vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (cfg: QueryConfig) => useInfiniteQuery(cfg),
}))

const postMock =
  vi.fn<(config: Record<string, unknown>) => Promise<{ data: unknown }>>()
vi.mock('@/shared/api/api', () => ({
  apiService: { post: (config: Record<string, unknown>) => postMock(config) },
}))

const getReportResultGateway = vi.fn<() => GatewayImplStub | null>()
vi.mock('../../../lib/report-result-gateway', () => ({
  getReportResultGateway: () => getReportResultGateway(),
}))

// SCRUM-288 T13: printEffect/exportEffect проигрываются через useSduiEffects,
// а не через gateway — мокаем хук, чтобы отследить play() отдельно от gateway.
const playMock = vi.fn()
vi.mock('../../../lib/use-sdui-effects', () => ({
  useSduiEffects: () => ({
    play: playMock,
    playAll: vi.fn(),
    executeActionRequest: vi.fn(),
  }),
}))

// SCRUM-370: команды настроек (блок Б) и расшифровки (блок В) уходят через
// useSduiDispatch — мокаем, чтобы не тянуть session-контекст и роутер.
const dispatchMock = vi.fn()
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatchMock,
}))

import { ReportResultNode } from './report-result-node'
import type { ViewNode } from '../../../types/view'

const baseQueryResult = {
  data: undefined,
  isLoading: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
}

const nodeWithSource = (props: Record<string, unknown> = {}): ViewNode =>
  ({
    id: 'report.OSV.result',
    type: 'REPORT_RESULT',
    props: {
      reportCode: 'OSV',
      reportLayout: 'LEDGER',
      pageSize: 200,
      source: { url: '/api/reportalt/OSV/run', method: 'POST', body: { a: 1 } },
      ...props,
    },
    children: [],
    actions: [],
  }) as unknown as ViewNode

// SCRUM-288 §3.2-3.5: printEffect/exportEffect — READY download-эффекты от
// бэка, кнопки должны проигрывать их через useSduiEffects, а не gateway.
const nodeWithPrintEffect = (props: Record<string, unknown> = {}): ViewNode =>
  nodeWithSource({
    settingsEnabled: true,
    printEffect: {
      type: 'download',
      request: {
        method: 'POST',
        url: '/api/reportalt/X/print',
        body: { parameters: {} },
      },
    },
    ...props,
  })

describe('ReportResultNode', () => {
  afterEach(() => {
    cleanup()
  })
  beforeEach(() => {
    useInfiniteQuery.mockReset()
    useInfiniteQuery.mockReturnValue(baseQueryResult)
    getReportResultGateway.mockReset()
    getReportResultGateway.mockReturnValue(null)
    postMock.mockReset()
    playMock.mockReset()
    dispatchMock.mockReset()
  })

  it('source=null → показывает placeholder, query выключен (enabled=false)', () => {
    const node = {
      id: 'report.OSV.result',
      type: 'REPORT_RESULT',
      props: {
        reportCode: 'OSV',
        reportLayout: 'LEDGER',
        source: null,
        placeholder: 'Нажмите «Сформировать»',
      },
      children: [],
      actions: [],
    } as unknown as ViewNode

    render(<ReportResultNode node={node} />)

    expect(
      screen.getByTestId('report-result-placeholder').textContent
    ).toContain('Нажмите «Сформировать»')
    const cfg = useInfiniteQuery.mock.calls[0]?.[0]
    expect(cfg.enabled).toBe(false)
  })

  it('source задан → query включён, gateway.Renderer вызывается с результатом', () => {
    const result = { reportCode: 'OSV', reportNameRu: 'ОСВ', rows: [{ id: 1 }] }
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      data: { pages: [result] },
    })
    const RendererMock = vi.fn((_props: { result: unknown }) => (
      <div data-testid="legacy-renderer" />
    ))
    getReportResultGateway.mockReturnValue({ Renderer: RendererMock })

    render(<ReportResultNode node={nodeWithSource()} />)

    const cfg = useInfiniteQuery.mock.calls[0]?.[0]
    expect(cfg.enabled).toBe(true)
    expect(screen.getByTestId('legacy-renderer')).toBeTruthy()
    expect(RendererMock.mock.calls[0]?.[0]).toEqual({ result })
  })

  it('gateway не зарегистрирован → безопасная плашка, без падения', () => {
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      data: { pages: [{ reportCode: 'OSV', rows: [] }] },
    })
    getReportResultGateway.mockReturnValue(null)

    expect(() =>
      render(<ReportResultNode node={nodeWithSource()} />)
    ).not.toThrow()
    expect(screen.getByTestId('report-result-gateway-missing')).toBeTruthy()
  })

  it('LEDGER: страницы мержатся (rows конкатенируются), «Показать ещё» зовёт fetchNextPage', () => {
    const page0 = {
      reportCode: 'OSV',
      page: 0,
      hasMore: true,
      rows: [{ id: 1 }],
    }
    const page1 = {
      reportCode: 'OSV',
      page: 1,
      hasMore: false,
      rows: [{ id: 2 }],
    }
    const fetchNextPage = vi.fn()
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      data: { pages: [page0, page1] },
      hasNextPage: true,
      fetchNextPage,
    })
    const RendererMock = vi.fn((_props: { result: unknown }) => (
      <div data-testid="legacy-renderer" />
    ))
    getReportResultGateway.mockReturnValue({ Renderer: RendererMock })

    render(<ReportResultNode node={nodeWithSource()} />)

    const call = RendererMock.mock.calls[0]?.[0] as
      | { result: { rows: unknown[] } }
      | undefined
    expect(call?.result.rows).toEqual([{ id: 1 }, { id: 2 }])

    fireEvent.click(screen.getByTestId('report-result-show-more'))
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it('non-LEDGER: getNextPageParam всегда undefined (одна страница, без пагинации)', () => {
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      data: { pages: [{ reportCode: 'X', hasMore: true, page: 0 }] },
    })
    getReportResultGateway.mockReturnValue({ Renderer: () => null })

    render(<ReportResultNode node={nodeWithSource({ reportLayout: 'TREE' })} />)

    const cfg = useInfiniteQuery.mock.calls[0]?.[0]
    expect(
      cfg.getNextPageParam({ hasMore: true, page: 0 }, [{}])
    ).toBeUndefined()
    expect(screen.queryByTestId('report-result-show-more')).toBeNull()
  })

  // SCRUM-370 блок Г: легаси-ветка печати удалена — printSource игнорируется,
  // печать существует только серверным printEffect.
  it('printSource игнорируется (легаси-ветка снята) — кнопки печати нет', () => {
    getReportResultGateway.mockReturnValue({
      Renderer: (() => null) as unknown as FC<{ result: unknown }>,
    })
    render(
      <ReportResultNode
        node={nodeWithSource({
          printSource: {
            url: '/api/reportalt/OSV/print?language=Kz',
            method: 'POST',
          },
        })}
      />
    )
    expect(screen.queryByTestId('report-result-print')).toBeNull()
  })

  it('без printSource → кнопки печати нет', () => {
    getReportResultGateway.mockReturnValue({
      Renderer: (() => null) as unknown as FC<{ result: unknown }>,
      print: vi.fn(),
    })
    render(<ReportResultNode node={nodeWithSource({ printEnabled: true })} />)
    expect(screen.queryByTestId('report-result-print')).toBeNull()
  })

  // SCRUM-370 блок Г: легаси-ветка экспорта удалена — exportEnabled
  // игнорируется, экспорт существует только серверным exportEffect.
  it('exportEnabled игнорируется (легаси-ветка снята) — кнопки экспорта нет', () => {
    const result = { reportCode: 'OSV', reportNameRu: 'ОСВ', rows: [] }
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      data: { pages: [result] },
    })
    getReportResultGateway.mockReturnValue({ Renderer: () => null })

    render(<ReportResultNode node={nodeWithSource({ exportEnabled: true })} />)

    expect(screen.queryByTestId('report-result-export')).toBeNull()
  })

  it('queryFn: тело POST — source.body целиком, без ручной сборки (§19.6)', async () => {
    postMock.mockResolvedValue({ data: { reportCode: 'OSV', rows: [] } })
    render(<ReportResultNode node={nodeWithSource()} />)

    const cfg = useInfiniteQuery.mock.calls[0]?.[0]
    await cfg.queryFn({ pageParam: 0 })

    expect(postMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/reportalt/OSV/run',
        data: { a: 1 },
        params: expect.objectContaining({ page: 0, pageSize: 200 }),
      })
    )
  })

  // SCRUM-370 блок Б шаг 2: клиентское наложение снято — apply не меняет тело
  // запроса, настройки доедут в source.body серверным патчем.
  it('settingsEnabled + gateway.SettingsPanel → apply НЕ меняет тело queryFn (наложение снято)', async () => {
    postMock.mockResolvedValue({ data: { reportCode: 'OSV', rows: [] } })
    const SettingsPanelStub: FC<SettingsPanelStubProps> = ({
      open,
      onApply,
    }) =>
      open ? (
        <button
          data-testid="apply-us"
          onClick={() => {
            onApply({ schemaVersionRef: 1 })
          }}
        >
          apply
        </button>
      ) : null
    getReportResultGateway.mockReturnValue({
      Renderer: () => null,
      SettingsPanel: SettingsPanelStub,
    })

    render(
      <ReportResultNode node={nodeWithSource({ settingsEnabled: true })} />
    )

    const settingsBtn = screen.getByTestId('report-result-settings')
    expect(settingsBtn).toBeTruthy()
    // панель ещё не открыта — фейковая кнопка apply не рендерится
    expect(screen.queryByTestId('apply-us')).toBeNull()

    fireEvent.click(settingsBtn)
    fireEvent.click(screen.getByTestId('apply-us'))

    const lastCfg = useInfiniteQuery.mock.calls.at(-1)?.[0]
    await lastCfg?.queryFn({ pageParam: 0 })

    expect(postMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/reportalt/OSV/run',
        data: { a: 1 },
      })
    )
  })

  it('settingsEnabled без gateway.SettingsPanel → кнопка «Настройки» не рендерится (fail-closed)', () => {
    getReportResultGateway.mockReturnValue({ Renderer: () => null })

    render(
      <ReportResultNode node={nodeWithSource({ settingsEnabled: true })} />
    )

    expect(screen.queryByTestId('report-result-settings')).toBeNull()
  })

  it('printEffect есть — «Печать» проигрывает эффект через useSduiEffects, gateway.print НЕ зовётся', () => {
    const printMock = vi.fn().mockResolvedValue(undefined)
    getReportResultGateway.mockReturnValue({
      Renderer: () => null,
      print: printMock,
    })

    render(<ReportResultNode node={nodeWithPrintEffect()} />)
    fireEvent.click(screen.getByTestId('report-result-print'))

    expect(playMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'download',
        request: expect.objectContaining({ url: '/api/reportalt/X/print' }),
      })
    )
    expect(printMock).not.toHaveBeenCalled()
  })

  it('exportEffect есть — «Экспорт» проигрывает эффект через useSduiEffects, gateway.exportXlsx НЕ зовётся', () => {
    const exportMock = vi.fn()
    getReportResultGateway.mockReturnValue({
      Renderer: () => null,
      exportXlsx: exportMock,
    })

    render(
      <ReportResultNode
        node={nodeWithPrintEffect({
          exportEffect: {
            type: 'download',
            request: {
              method: 'POST',
              url: '/api/reportalt/X/export',
              body: { parameters: {} },
            },
          },
        })}
      />
    )
    fireEvent.click(screen.getByTestId('report-result-export'))

    expect(playMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'download',
        request: expect.objectContaining({ url: '/api/reportalt/X/export' }),
      })
    )
    expect(exportMock).not.toHaveBeenCalled()
  })

  // SCRUM-370 блок Б шаг 2: printEffect проигрывается как есть — сервер сам
  // кладёт настройки в request.body эффекта (патч setProp printEffect).
  it('после apply printEffect проигрывается как есть, без домешивания', () => {
    const SettingsPanelStub: FC<SettingsPanelStubProps> = ({
      open,
      onApply,
    }) =>
      open ? (
        <button
          data-testid="apply-us"
          onClick={() => {
            onApply({ schemaVersionRef: 1 })
          }}
        >
          apply
        </button>
      ) : null
    getReportResultGateway.mockReturnValue({
      Renderer: () => null,
      SettingsPanel: SettingsPanelStub,
    })

    render(<ReportResultNode node={nodeWithPrintEffect()} />)

    fireEvent.click(screen.getByTestId('report-result-settings'))
    fireEvent.click(screen.getByTestId('apply-us'))
    fireEvent.click(screen.getByTestId('report-result-print'))

    expect(playMock).toHaveBeenCalledWith({
      type: 'download',
      request: {
        method: 'POST',
        url: '/api/reportalt/X/print',
        body: { parameters: {} },
      },
    })
  })

  it('без userSettings — printEffect проигрывается как есть, request.body не меняется', () => {
    getReportResultGateway.mockReturnValue({ Renderer: () => null })

    render(<ReportResultNode node={nodeWithPrintEffect()} />)
    fireEvent.click(screen.getByTestId('report-result-print'))

    expect(playMock).toHaveBeenCalledWith({
      type: 'download',
      request: {
        method: 'POST',
        url: '/api/reportalt/X/print',
        body: { parameters: {} },
      },
    })
  })

  // SCRUM-370 блок Б шаг 1: apply/reset дополнительно диспатчат серверные
  // команды из пропов (по наличию), локальное наложение сохраняется.
  it('settingsApplyCommand: apply диспатчит COMMAND с объектом настроек', () => {
    const SettingsPanelStub: FC<SettingsPanelStubProps> = ({
      open,
      onApply,
    }) =>
      open ? (
        <button
          data-testid="apply-us"
          onClick={() => {
            onApply({ x: 1 })
          }}
        >
          apply
        </button>
      ) : null
    getReportResultGateway.mockReturnValue({
      Renderer: () => null,
      SettingsPanel: SettingsPanelStub,
    })

    render(
      <ReportResultNode
        node={nodeWithSource({
          settingsEnabled: true,
          settingsApplyCommand: 'report.settings.apply',
        })}
      />
    )
    fireEvent.click(screen.getByTestId('report-result-settings'))
    fireEvent.click(screen.getByTestId('apply-us'))

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'report.settings.apply',
      value: { x: 1 },
    })
  })

  it('без settingsApplyCommand (старый бэк) — apply не диспатчит команду', () => {
    const SettingsPanelStub: FC<SettingsPanelStubProps> = ({
      open,
      onApply,
    }) =>
      open ? (
        <button
          data-testid="apply-us"
          onClick={() => {
            onApply({ x: 1 })
          }}
        >
          apply
        </button>
      ) : null
    getReportResultGateway.mockReturnValue({
      Renderer: () => null,
      SettingsPanel: SettingsPanelStub,
    })

    render(
      <ReportResultNode node={nodeWithSource({ settingsEnabled: true })} />
    )
    fireEvent.click(screen.getByTestId('report-result-settings'))
    fireEvent.click(screen.getByTestId('apply-us'))

    expect(dispatchMock).not.toHaveBeenCalled()
  })

  // SCRUM-370 блок В: drilldownCommand → Renderer получает onDrilldown,
  // rowRef уходит эхом; строка без rowRef не шлётся; без пропа — колбэка нет.
  it('drilldownCommand: строка с rowRef диспатчит COMMAND с эхом rowRef, без rowRef — ничего', () => {
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      data: { pages: [{ reportCode: 'OSV', rows: [] }] },
    })
    const rowRef = { domain: 'DOCUMENT', typeCode: 'VybytieTMZ', id: 4521 }
    const RendererStub: FC<{
      result: unknown
      onDrilldown?: (row: unknown) => void
    }> = ({ onDrilldown }) => (
      <>
        <button
          data-testid="row-with-ref"
          onClick={() => onDrilldown?.({ level: 0, rowRef })}
        >
          r1
        </button>
        <button
          data-testid="row-without-ref"
          onClick={() => onDrilldown?.({ level: 0 })}
        >
          r2
        </button>
      </>
    )
    getReportResultGateway.mockReturnValue({ Renderer: RendererStub })

    render(
      <ReportResultNode
        node={nodeWithSource({ drilldownCommand: 'report.drilldown' })}
      />
    )

    fireEvent.click(screen.getByTestId('row-without-ref'))
    expect(dispatchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('row-with-ref'))
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'report.drilldown',
      value: { rowRef },
    })
  })

  it('без drilldownCommand — Renderer получает onDrilldown=undefined (строки не кликабельны)', () => {
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      data: { pages: [{ reportCode: 'OSV', rows: [] }] },
    })
    const seen: unknown[] = []
    const RendererStub: FC<{
      result: unknown
      onDrilldown?: (row: unknown) => void
    }> = ({ onDrilldown }) => {
      seen.push(onDrilldown)
      return null
    }
    getReportResultGateway.mockReturnValue({ Renderer: RendererStub })

    render(<ReportResultNode node={nodeWithSource()} />)

    expect(seen).toEqual([undefined])
  })
})
