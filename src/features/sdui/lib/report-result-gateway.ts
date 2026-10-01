import type { FC } from 'react'

// SCRUM-291 K2: мост к легаси-рендереру результата отчёта
// (`features/report-result-view`, чистый компонент {result}). SDUI не может
// импортировать легаси напрямую (правило изоляции CLAUDE.md) — реализацию
// подключает хост-приложение на уровне `app/` (образец: workspace-tab-gateway.ts).
export interface ReportResultGatewayImpl {
  // Рисует результат отчёта. result структурно совместим с ReportResultDto/
  // ReportAltResultDto, но SDUI держит его как unknown — не разбирает, не мутирует.
  // onDrilldown (SCRUM-370 блок В) — серверная расшифровка строки LEDGER; SDUI
  // читает у строки ровно одно поле rowRef, остальное непрозрачно (§19.6).
  // onRowMenu — запрос действий по строке (двойной клик ∥ правая кнопка, как в
  // 1С): рендерер сообщает строку и координаты курсора, само меню рисует SDUI —
  // состав пунктов знает он (команда расшифровки живёт в пропсах ноды).
  Renderer: FC<{
    result: unknown
    onDrilldown?: (row: unknown) => void
    onRowMenu?: (
      row: unknown,
      ancestors: unknown[],
      position: { top: number; left: number },
      zone: 'label' | 'value'
    ) => void
  }>
  // Панель настроек отчёта (опц., §19.1): полностью реализуется на app-слое
  // (легаси-drawer + meta-фетч). SDUI держит userSettings как unknown.
  SettingsPanel?: FC<{
    reportCode: string
    appliedUserSettings: unknown
    onApply: (userSettings: unknown) => void
    onReset: () => void
    open: boolean
    onClose: () => void
  }>
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
