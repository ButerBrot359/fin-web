import { afterEach, describe, expect, it } from 'vitest'

import {
  getReportResultGateway,
  setReportResultGateway,
  type ReportResultGatewayImpl,
} from './report-result-gateway'

describe('report-result-gateway', () => {
  afterEach(() => {
    setReportResultGateway(null)
  })

  it('возвращает null, пока реализация не зарегистрирована', () => {
    expect(getReportResultGateway()).toBeNull()
  })

  it('set/get — реализация регистрируется и возвращается как есть', () => {
    const impl: ReportResultGatewayImpl = {
      Renderer: () => null,
    }
    setReportResultGateway(impl)
    expect(getReportResultGateway()).toBe(impl)
  })

  it('set(null) снимает реализацию (cleanup при размонтировании app/)', () => {
    setReportResultGateway({ Renderer: () => null })
    setReportResultGateway(null)
    expect(getReportResultGateway()).toBeNull()
  })

  // SCRUM-370 блок Г: print/exportXlsx удалены из контракта — печать и экспорт
  // идут только серверными READY-эффектами, у gateway остался рендер и панель.
  it('минимальная реализация — только Renderer', () => {
    const impl: ReportResultGatewayImpl = { Renderer: () => null }
    setReportResultGateway(impl)
    expect(getReportResultGateway()).toBe(impl)
  })
})
