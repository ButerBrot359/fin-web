import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { Sidebar } from '@/widgets/sidebar'
import { TopBar } from '@/widgets/top-bar'
import { MainPage } from '@/pages/main'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

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

function App() {
  return (
    <BrowserRouter>
      <Layout sidebar={<Sidebar />} header={<TopBar />}>
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
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  )
}

export default App
