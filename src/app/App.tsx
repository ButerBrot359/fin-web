import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { MainPage } from '@/pages/main'

import { TopBar } from '@/widgets/top-bar'
import { Sidebar } from '@/widgets/sidebar'

import { DictSidebarDrawer, useDictSidebarStore } from '@/features/dict-sidebar'
import {
  ShellSidebarHost,
  setReferencePickerGateway,
  setReportResultGateway,
} from '@/features/sdui'
import { WorkspaceTabSync } from '@/widgets/workspace-tab-bar'

// SCRUM-291 K2: REPORT_RESULT-нода SDUI монтирует легаси-рендерер результата
// отчёта только через gateway (`setReportResultGateway`) — прямой импорт
// легаси в SDUI запрещён (CLAUDE.md). Легаси-импорты живут ИСКЛЮЧИТЕЛЬНО
// здесь, в app/.
import { ReportResultView } from '@/features/report-result-view'
import { buildReportAltExport } from '@/pages/reportalt/lib/utils/build-reportalt-export'
import type { ReportAltResultDto } from '@/pages/reportalt/types/reportalt'

import { apiService } from '@/shared/api/api'
import { Toaster } from '@/shared/ui/toast/toast'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'
import { ErrorBoundary } from '@/shared/ui/error-boundary/error-boundary'
import { exportTableToXlsx } from '@/shared/lib/table-export'

import { Layout } from './layout/layout'
import { useWorkspaceTabGatewayBinding } from './providers/workspace-tab-binding'
import { ReportSettingsPanel } from './providers/report-settings-panel'

const ModulePage = lazy(() =>
  import('@/pages/module').then((m) => ({ default: m.ModulePage }))
)
const DocumentEntryPage = lazy(() =>
  import('@/pages/documents/documents-entry').then((m) => ({
    default: m.DocumentEntryPage,
  }))
)
const DocumentRedirect = lazy(() =>
  import('@/pages/documents/document-redirect').then((m) => ({
    default: m.DocumentRedirect,
  }))
)
const DictionaryRedirect = lazy(() =>
  import('@/pages/dictionaries/dictionary-redirect').then((m) => ({
    default: m.DictionaryRedirect,
  }))
)
const DictionaryEntryPage = lazy(() =>
  import('@/pages/dictionaries/dictionary-entry').then((m) => ({
    default: m.DictionaryEntryPage,
  }))
)
const AccountPlanEntryPage = lazy(() =>
  import('@/pages/account-plan/account-plan-entry').then((m) => ({
    default: m.AccountPlanEntryPage,
  }))
)
const AccountCardPage = lazy(() =>
  import('@/pages/account-card').then((m) => ({
    default: m.AccountCardPage,
  }))
)
const TreasuryExportPage = lazy(() =>
  import('@/features/treasury-export').then((m) => ({
    default: m.TreasuryExportPage,
  }))
)
const SduiCatchAllPage = lazy(() =>
  import('@/pages/sdui-catch-all').then((m) => ({
    default: m.SduiCatchAllPage,
  }))
)

const AppRoutes = () => {
  const location = useLocation()

  return (
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<MainPage />} />
          {/*
            Выгрузка документов в казначейство (SCRUM-265): SDUI-эффект
            navigate ведёт сюда с ?typeCode&id — легаси-страница вне SDUI.
          */}
          <Route path="/treasury-export" element={<TreasuryExportPage />} />
          <Route path="/modules/:pageCode" element={<ModulePage />} />
          <Route
            path="/modules/:pageCode/document/:moduleCode/new"
            element={<DocumentEntryPage />}
          />
          <Route
            path="/modules/:pageCode/document/:moduleCode/:entryId"
            element={<DocumentEntryPage />}
          />
          {/*
            SCRUM-268 §3.6: плоские ссылки с бэка /documents/:typeCode[/new] —
            фронт резолвит раздел по метаданным модулей и редиректит в
            /modules/:pageCode/document/:typeCode. Временный мост до
            server-driven shell (отклонение D-1, ревизия SDUI раздел 9).
          */}
          <Route
            path="/documents/:typeCode"
            element={<DocumentRedirect mode="list" />}
          />
          <Route
            path="/documents/:typeCode/new"
            element={<DocumentRedirect mode="new" />}
          />
          <Route
            path="/documents/:typeCode/:entryId"
            element={<DocumentRedirect mode="entry" />}
          />
          <Route
            path="/dictionaries/:typeCode"
            element={<DictionaryRedirect mode="list" />}
          />
          <Route
            path="/dictionaries/:typeCode/:entryId"
            element={<DictionaryRedirect mode="entry" />}
          />
          <Route
            path="/modules/:pageCode/dictionary/:moduleCode/new"
            element={<DictionaryEntryPage />}
          />
          <Route
            path="/modules/:pageCode/dictionary/:moduleCode/:entryId"
            element={<DictionaryEntryPage />}
          />
          <Route
            path="/modules/:pageCode/accountplan/:moduleCode/new"
            element={<AccountPlanEntryPage />}
          />
          <Route
            path="/modules/:pageCode/accountplan/:moduleCode/:entryId"
            element={<AccountPlanEntryPage />}
          />
          {/* Карточка счёта — drill-down из ОСВ (двойной клик по строке). */}
          <Route
            path="/modules/:pageCode/account-card"
            element={<AccountCardPage />}
          />
          <Route path="*" element={<SduiCatchAllPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

function App() {
  useWorkspaceTabGatewayBinding()
  const { t, i18n } = useTranslation()

  useEffect(() => {
    setReferencePickerGateway((req) => {
      useDictSidebarStore.getState().push({
        mode: req.mode,
        domain: req.domain,
        typeCode: req.typeCode,
        entryId: req.entryId,
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
      Renderer: ({ result }) => (
        <ReportResultView result={result as ReportAltResultDto} />
      ),
      print: (url, body) =>
        apiService.postFileBlob({ url, data: body }).then((res) => {
          window.open(URL.createObjectURL(res.data))
        }),
      exportXlsx: (result, reportName) => {
        const data = buildReportAltExport(
          result as ReportAltResultDto,
          i18n.language === 'kz',
          t('reportalt.group'),
          t('reportalt.total')
        )
        exportTableToXlsx(reportName, data)
      },
      SettingsPanel: (props) => <ReportSettingsPanel {...props} />,
    })
    return () => {
      setReportResultGateway(null)
    }
  }, [t, i18n])

  return (
    <BrowserRouter>
      <WorkspaceTabSync />
      <Layout
        sidebar={<ShellSidebarHost fallback={<Sidebar />} />}
        header={<TopBar />}
      >
        <AppRoutes />
      </Layout>
      <DictSidebarDrawer />
      <Toaster />
    </BrowserRouter>
  )
}

export default App
