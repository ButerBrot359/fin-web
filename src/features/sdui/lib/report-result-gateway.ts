import type { FC } from 'react'

// SCRUM-291 K2: мост к легаси-рендереру результата отчёта
// (`features/report-result-view`, чистый компонент {result}). SDUI не может
// импортировать легаси напрямую (правило изоляции CLAUDE.md) — реализацию
// подключает хост-приложение на уровне `app/` (образец: workspace-tab-gateway.ts).
export interface ReportResultGatewayImpl {
  // Рисует результат отчёта. result структурно совместим с ReportResultDto/
  // ReportAltResultDto, но SDUI держит его как unknown — не разбирает, не мутирует.
  Renderer: FC<{ result: unknown }>
  // Печать (опц.): POST .../print. code+body+language, blob открывает impl.
  print?: (code: string, body: unknown, language: string) => Promise<void>
  // Экспорт в XLSX (опц.): клиентский, из result.
  exportXlsx?: (result: unknown, reportName: string) => void
}

let impl: ReportResultGatewayImpl | null = null

export function setReportResultGateway(
  g: ReportResultGatewayImpl | null
): void {
  impl = g
}

export function getReportResultGateway(): ReportResultGatewayImpl | null {
  return impl
}
