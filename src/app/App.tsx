import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'

import { MainPage } from '@/pages/main'

import { TopBar } from '@/widgets/top-bar'
import { Sidebar } from '@/widgets/sidebar'

import { DictSidebarDrawer, useDictSidebarStore } from '@/features/dict-sidebar'
import { setReferencePickerGateway } from '@/features/sdui'
import { WorkspaceTabSync } from '@/widgets/workspace-tab-bar'

import { Toaster } from '@/shared/ui/toast/toast'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'
import { ErrorBoundary } from '@/shared/ui/error-boundary/error-boundary'

import { Layout } from './layout/layout'
import { useWorkspaceTabGatewayBinding } from './providers/workspace-tab-binding'

const ModulePage = lazy(() =>
  import('@/pages/module').then((m) => ({ default: m.ModulePage }))
)
const DocumentPage = lazy(() =>
  import('@/pages/documents/document-list').then((m) => ({
    default: m.DocumentPage,
  }))
)
const DocumentEntryPage = lazy(() =>
  import('@/pages/documents/documents-entry').then((m) => ({
    default: m.DocumentEntryPage,
  }))
)
const DocumentMovementsPage = lazy(() =>
  import('@/pages/documents/document-movements').then((m) => ({
    default: m.DocumentMovementsPage,
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
const DictionaryPage = lazy(() =>
  import('@/pages/dictionaries/dictionary-list').then((m) => ({
    default: m.DictionaryPage,
  }))
)
const DictionaryEntryPage = lazy(() =>
  import('@/pages/dictionaries/dictionary-entry').then((m) => ({
    default: m.DictionaryEntryPage,
  }))
)
const InformationRegisterPage = lazy(() =>
  import('@/pages/information-register/information-register-list').then(
    (m) => ({
      default: m.InformationRegisterPage,
    })
  )
)
const AccumulationRegisterPage = lazy(() =>
  import('@/pages/accumulation-register/accumulation-register-list').then(
    (m) => ({
      default: m.AccumulationRegisterPage,
    })
  )
)
const AccountingRegisterPage = lazy(() =>
  import('@/pages/accounting-register/accounting-register-list').then((m) => ({
    default: m.AccountingRegisterPage,
  }))
)
const AccountPlanPage = lazy(() =>
  import('@/pages/account-plan/account-plan-list').then((m) => ({
    default: m.AccountPlanPage,
  }))
)
const AccountPlanEntryPage = lazy(() =>
  import('@/pages/account-plan/account-plan-entry').then((m) => ({
    default: m.AccountPlanEntryPage,
  }))
)
const OsvReportPage = lazy(() =>
  import('@/pages/osv-report/osv-report-list').then((m) => ({
    default: m.OsvReportPage,
  }))
)
const AccountCardPage = lazy(() =>
  import('@/pages/account-card').then((m) => ({
    default: m.AccountCardPage,
  }))
)
const FinancingPlanUploadPage = lazy(() =>
  import('@/pages/financing-plan-upload').then((m) => ({
    default: m.FinancingPlanUploadPage,
  }))
)
const UniversalDomainPage = lazy(() =>
  import('@/pages/universal-domain/universal-domain-list').then((m) => ({
    default: m.UniversalDomainPage,
  }))
)
const ReportPage = lazy(() =>
  import('@/pages/reports/report-list').then((m) => ({
    default: m.ReportPage,
  }))
)
const ReportAltPage = lazy(() =>
  import('@/pages/reportalt').then((m) => ({
    default: m.ReportAltPage,
  }))
)

const AppRoutes = () => {
  const location = useLocation()

  return (
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/modules/:pageCode" element={<ModulePage />} />
          <Route
            path="/modules/:pageCode/document/:moduleCode"
            element={<DocumentPage />}
          />
          <Route
            path="/modules/:pageCode/document/:moduleCode/new"
            element={<DocumentEntryPage />}
          />
          <Route
            path="/modules/:pageCode/document/:moduleCode/:entryId"
            element={<DocumentEntryPage />}
          />
          <Route
            path="/modules/:pageCode/document/:moduleCode/:entryId/movements"
            element={<DocumentMovementsPage />}
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
            path="/dictionaries/:typeCode"
            element={<DictionaryRedirect mode="list" />}
          />
          <Route
            path="/dictionaries/:typeCode/:entryId"
            element={<DictionaryRedirect mode="entry" />}
          />
          <Route
            path="/modules/:pageCode/dictionary/:moduleCode"
            element={<DictionaryPage />}
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
            path="/modules/:pageCode/informationregister/:moduleCode"
            element={<InformationRegisterPage />}
          />
          <Route
            path="/modules/:pageCode/accumulationregister/:moduleCode"
            element={<AccumulationRegisterPage />}
          />
          <Route
            path="/modules/:pageCode/accountingregister/:moduleCode"
            element={<AccountingRegisterPage />}
          />
          <Route
            path="/modules/:pageCode/accountplan/:moduleCode"
            element={<AccountPlanPage />}
          />
          <Route
            path="/modules/:pageCode/accountplan/:moduleCode/new"
            element={<AccountPlanEntryPage />}
          />
          <Route
            path="/modules/:pageCode/accountplan/:moduleCode/:entryId"
            element={<AccountPlanEntryPage />}
          />
          {/* ОСВ: пункт меню type="AccountingReport" → сегмент "accountingreport" */}
          <Route
            path="/modules/:pageCode/accountingreport/:moduleCode"
            element={<OsvReportPage />}
          />
          {/* Карточка счёта — drill-down из ОСВ (двойной клик по строке). */}
          <Route
            path="/modules/:pageCode/account-card"
            element={<AccountCardPage />}
          />
          {/* Обработка: пункт меню type="DataProcessor" → сегмент "dataprocessor". */}
          <Route
            path="/modules/:pageCode/dataprocessor/:moduleCode"
            element={<FinancingPlanUploadPage />}
          />
          {/*
            План видов расчёта (type="CalculationPlan" → сегмент
            "calculationplan") и прочие типы объектов без выделенного
            контроллера обслуживаются универсальным доменом — список строится
            по `?domain=...` + typeCode.
          */}
          <Route
            path="/modules/:pageCode/calculationplan/:moduleCode"
            element={<UniversalDomainPage />}
          />
          {/*
            Универсальная страница отчётов: пункт меню type="Report" →
            сегмент "report". Любой отчёт рендерится по коду (`:moduleCode`)
            через метаданные `/api/reports/{code}/meta`.
          */}
          <Route
            path="/modules/:pageCode/report/:moduleCode"
            element={<ReportPage />}
          />
          {/*
            Новый отчётный контур ReportAlt: пункт меню type="ReportAlt" →
            сегмент "reportalt". Отчёт рендерится по коду через метаданные
            `/api/reportalt/{code}/meta`.
          */}
          <Route
            path="/modules/:pageCode/reportalt/:moduleCode"
            element={<ReportAltPage />}
          />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

function App() {
  useWorkspaceTabGatewayBinding()

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

  return (
    <BrowserRouter>
      <WorkspaceTabSync />
      <Layout sidebar={<Sidebar />} header={<TopBar />}>
        <AppRoutes />
      </Layout>
      <DictSidebarDrawer />
      <Toaster />
    </BrowserRouter>
  )
}

export default App
