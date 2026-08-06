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
  print?: (code: string, body: unknown, language: string) => Promise<void>
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

  it('printEnabled → кнопка печати зовёт gateway.print(reportCode, source.body, language)', () => {
    const printMock = vi.fn().mockResolvedValue(undefined)
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      data: { pages: [{ reportCode: 'OSV', rows: [] }] },
    })
    getReportResultGateway.mockReturnValue({
      Renderer: () => null,
      print: printMock,
    })

    render(<ReportResultNode node={nodeWithSource({ printEnabled: true })} />)

    fireEvent.click(screen.getByTestId('report-result-print'))
    expect(printMock).toHaveBeenCalledWith('OSV', { a: 1 }, 'ru')
  })

  it('exportEnabled → кнопка экспорта зовёт gateway.exportXlsx(result, reportName)', () => {
    const exportMock = vi.fn()
    const result = { reportCode: 'OSV', reportNameRu: 'ОСВ', rows: [] }
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      data: { pages: [result] },
    })
    getReportResultGateway.mockReturnValue({
      Renderer: () => null,
      exportXlsx: exportMock,
    })

    render(<ReportResultNode node={nodeWithSource({ exportEnabled: true })} />)

    fireEvent.click(screen.getByTestId('report-result-export'))
    expect(exportMock).toHaveBeenCalledWith(result, 'ОСВ')
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

  it('settingsEnabled + gateway.SettingsPanel → кнопка «Настройки» открывает панель, apply наложением userSettings меняет тело следующего queryFn (§19.6)', async () => {
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
        data: { a: 1, userSettings: { schemaVersionRef: 1 } },
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
})
