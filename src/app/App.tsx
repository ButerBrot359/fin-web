import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'

import { MainPage } from '@/pages/main'

import { TopBar } from '@/widgets/top-bar'
import { Sidebar } from '@/widgets/sidebar'

import { DictSidebarDrawer } from '@/features/dict-sidebar'
import { WorkspaceTabSync } from '@/widgets/workspace-tab-bar'

import { Toaster } from '@/shared/ui/toast/toast'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'
import { ErrorBoundary } from '@/shared/ui/error-boundary/error-boundary'

import { Layout } from './layout/layout'

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
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

function App() {
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
