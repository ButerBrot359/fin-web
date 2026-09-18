import { lazy, type ReactElement } from 'react'

import { lazyNamed } from '@/shared/lib/utils/lazy-named'

// Ленивые легаси-страницы (композиционный слой знает оба мира).
const DocumentPage = lazyNamed(
  () => import('@/pages/documents/document-list'),
  'DocumentPage'
)
const DocumentMovementsPage = lazyNamed(
  () => import('@/pages/documents/document-movements'),
  'DocumentMovementsPage'
)
const DictionaryPage = lazyNamed(
  () => import('@/pages/dictionaries/dictionary-list'),
  'DictionaryPage'
)
const InformationRegisterPage = lazyNamed(
  () => import('@/pages/information-register/information-register-list'),
  'InformationRegisterPage'
)
const AccumulationRegisterPage = lazyNamed(
  () => import('@/pages/accumulation-register/accumulation-register-list'),
  'AccumulationRegisterPage'
)
const AccountingRegisterPage = lazyNamed(
  () => import('@/pages/accounting-register/accounting-register-list'),
  'AccountingRegisterPage'
)
const AccountPlanPage = lazyNamed(
  () => import('@/pages/account-plan/account-plan-list'),
  'AccountPlanPage'
)
const OsvReportPage = lazyNamed(
  () => import('@/pages/osv-report/osv-report-list'),
  'OsvReportPage'
)
const ReportPage = lazyNamed(
  () => import('@/pages/reports/report-list'),
  'ReportPage'
)
const ReportAltPage = lazyNamed(
  () => import('@/pages/reportalt'),
  'ReportAltPage'
)
const FinancingPlanUploadPage = lazyNamed(
  () => import('@/pages/financing-plan-upload'),
  'FinancingPlanUploadPage'
)
const UniversalDomainPage = lazyNamed(
  () => import('@/pages/universal-domain/universal-domain-list'),
  'UniversalDomainPage'
)
const LegacyDocumentEntryPage = lazyNamed(
  () => import('@/pages/documents/documents-entry'),
  'LegacyDocumentEntryPage'
)
const LegacyDictionaryEntryPage = lazyNamed(
  () => import('@/pages/dictionaries/dictionary-entry'),
  'LegacyDictionaryEntryPage'
)
const DocumentRedirectList = lazy(() =>
  import('@/pages/documents/document-redirect').then((m) => ({
    default: () => <m.DocumentRedirect mode="list" />,
  }))
)
const DocumentRedirectEntry = lazy(() =>
  import('@/pages/documents/document-redirect').then((m) => ({
    default: () => <m.DocumentRedirect mode="entry" />,
  }))
)
const DocumentRedirectNew = lazy(() =>
  import('@/pages/documents/document-redirect').then((m) => ({
    default: () => <m.DocumentRedirect mode="new" />,
  }))
)
const DictionaryRedirectList = lazy(() =>
  import('@/pages/dictionaries/dictionary-redirect').then((m) => ({
    default: () => <m.DictionaryRedirect mode="list" />,
  }))
)
const DictionaryRedirectEntry = lazy(() =>
  import('@/pages/dictionaries/dictionary-redirect').then((m) => ({
    default: () => <m.DictionaryRedirect mode="entry" />,
  }))
)

export interface LegacyRoute {
  path: string
  element: ReactElement
}

// Виды экрана, для которых бэк отдаёт 422 SCREEN_NOT_SDUI (§3 бэк-спеки).
// Инфраструктура под task 9: в Phase 2 явные <Route> перехватывают эти
// маршруты раньше catch-all, поэтому таблица дремлет, но обязана быть полной.
//
// Бэк резолвит и плоские роуты (/documents/:typeCode…, /dictionaries/:typeCode…),
// но 422 на плоском URL легаси-странице бесполезен — там нет pageCode. Поэтому
// у карточных/списковых document-/dictionary- kind по два элемента: module-путь
// ведёт прямо на легаси-страницу, плоский — на редирект, который сам находит
// pageCode и уходит на module-URL (рулинг контроллера 2026-08-31, SCRUM-360 этап B).
const KIND_TO_LEGACY: Record<string, LegacyRoute[]> = {
  DOCUMENT_LIST: [
    {
      path: '/modules/:pageCode/document/:moduleCode',
      element: <DocumentPage />,
    },
    { path: '/documents/:typeCode', element: <DocumentRedirectList /> },
  ],
  DOCUMENT_MOVEMENTS: [
    {
      path: '/modules/:pageCode/document/:moduleCode/:entryId/movements',
      element: <DocumentMovementsPage />,
    },
  ],
  DOCUMENT: [
    {
      path: '/modules/:pageCode/document/:moduleCode/:entryId',
      element: <LegacyDocumentEntryPage />,
    },
    {
      path: '/documents/:typeCode/:entryId',
      element: <DocumentRedirectEntry />,
    },
  ],
  DOCUMENT_NEW: [
    {
      path: '/modules/:pageCode/document/:moduleCode/new',
      element: <LegacyDocumentEntryPage />,
    },
    { path: '/documents/:typeCode/new', element: <DocumentRedirectNew /> },
  ],
  DICTIONARY_LIST: [
    {
      path: '/modules/:pageCode/dictionary/:moduleCode',
      element: <DictionaryPage />,
    },
    { path: '/dictionaries/:typeCode', element: <DictionaryRedirectList /> },
  ],
  DICTIONARY: [
    {
      path: '/modules/:pageCode/dictionary/:moduleCode/:entryId',
      element: <LegacyDictionaryEntryPage />,
    },
    {
      path: '/dictionaries/:typeCode/:entryId',
      element: <DictionaryRedirectEntry />,
    },
  ],
  DICTIONARY_NEW: [
    {
      path: '/modules/:pageCode/dictionary/:moduleCode/new',
      element: <LegacyDictionaryEntryPage />,
    },
  ],
  REGISTER: [
    {
      path: '/modules/:pageCode/informationregister/:moduleCode',
      element: <InformationRegisterPage />,
    },
  ],
  // SCRUM-45 / ADR-0044_SDUI: бэк развёл вид списка регистра сведений
  // (REGISTER_LIST) и карточки записи (REGISTER) — предикат «это список»
  // проверяется раньше резолва layoutCode. Легаси-страница у обоих одна.
  REGISTER_LIST: [
    {
      path: '/modules/:pageCode/informationregister/:moduleCode',
      element: <InformationRegisterPage />,
    },
  ],
  ACCUMULATION_REGISTER: [
    {
      path: '/modules/:pageCode/accumulationregister/:moduleCode',
      element: <AccumulationRegisterPage />,
    },
  ],
  ACCOUNTING_REGISTER: [
    {
      path: '/modules/:pageCode/accountingregister/:moduleCode',
      element: <AccountingRegisterPage />,
    },
  ],
  ACCOUNT_PLAN: [
    {
      path: '/modules/:pageCode/accountplan/:moduleCode',
      element: <AccountPlanPage />,
    },
  ],
  ACCOUNTING_REPORT: [
    {
      path: '/modules/:pageCode/accountingreport/:moduleCode',
      element: <OsvReportPage />,
    },
  ],
  REPORT: [
    {
      path: '/modules/:pageCode/report/:moduleCode',
      element: <ReportPage />,
    },
  ],
  REPORT_ALT: [
    {
      path: '/modules/:pageCode/reportalt/:moduleCode',
      element: <ReportAltPage />,
    },
  ],
  DATA_PROCESSOR: [
    {
      path: '/modules/:pageCode/dataprocessor/:moduleCode',
      element: <FinancingPlanUploadPage />,
    },
  ],
  CALCULATION_PLAN: [
    {
      path: '/modules/:pageCode/calculationplan/:moduleCode',
      element: <UniversalDomainPage />,
    },
  ],
}

export function resolveLegacyRoutes(kind: string): LegacyRoute[] | null {
  return KIND_TO_LEGACY[kind] ?? null
}
