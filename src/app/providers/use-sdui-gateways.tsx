import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

// Reference-picker-gateway (SDUI → легаси-справочники): реализация — push в
// стор dict-sidebar. Стор импортируется напрямую (не через барель), чтобы
// статическая часть моста оставалась крошечной, а тяжёлый UI дровера
// (dict-sidebar + form-renderer) уезжал в отдельный ленивый чанк (см. App.tsx).
import { useDictSidebarStore } from '@/features/dict-sidebar/lib/hooks/use-dict-sidebar-store'
import {
  setReferencePickerGateway,
  setReportResultGateway,
} from '@/features/sdui'

// SCRUM-291 K2: REPORT_RESULT-нода SDUI монтирует легаси-рендерер результата
// отчёта только через gateway (`setReportResultGateway`) — прямой импорт
// легаси в SDUI запрещён (CLAUDE.md). Легаси-импорты живут ИСКЛЮЧИТЕЛЬНО
// здесь, в app/.
import { ReportResultView } from '@/features/report-result-view'
import type { ReportAltResultDto } from '@/pages/reportalt/types/reportalt'

import { ReportSettingsPanel } from './report-settings-panel'

/**
 * Подключение SDUI-gateway'ев к их легаси-реализациям. Единственное место,
 * которому позволено знать оба мира, — app-слой (образец рядом:
 * workspace-tab-binding.ts).
 */
export function useSduiGateways(): void {
  const { t, i18n } = useTranslation()

  useEffect(() => {
    setReferencePickerGateway((req) => {
      useDictSidebarStore.getState().push({
        mode: req.mode,
        domain: req.domain,
        typeCode: req.typeCode,
        entryId: req.entryId,
        selectedId: req.selectedId,
        onSelect: req.onSelect,
        searchParams: req.searchParams,
      })
    })
    return () => {
      setReferencePickerGateway(null)
    }
  }, [])

  // SCRUM-291 K2: реализация REPORT_RESULT-gateway — легаси-рендерер
  // `ReportResultView` (чистый, принимает {result}), печать/экспорт — те же
  // легаси-эндпоинты/утилиты, что использует `reportalt-page.tsx`.
  useEffect(() => {
    setReportResultGateway({
      // ReportResultView типизирован своим ReportResultDto (не экспортирован
      // из барреля слайса) — gateway держит result как unknown (§ дизайн-док),
      // адаптер приводит на границе, без утечки типа наружу SDUI.
      Renderer: ({ result, onDrilldown, onRowMenu }) => (
        <ReportResultView
          result={result as ReportAltResultDto}
          onDrilldown={onDrilldown}
          onRowDoubleClick={
            onRowMenu
              ? (row, ancestors, event) => {
                  onRowMenu(row, ancestors, {
                    top: event.clientY,
                    left: event.clientX,
                  })
                }
              : undefined
          }
          onRowContextMenu={
            onRowMenu
              ? (row, ancestors, event) => {
                  onRowMenu(row, ancestors, {
                    top: event.clientY,
                    left: event.clientX,
                  })
                }
              : undefined
          }
        />
      ),
      SettingsPanel: (props) => <ReportSettingsPanel {...props} />,
    })
    return () => {
      setReportResultGateway(null)
    }
  }, [t, i18n])
}
