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
  import('@/pages/document').then((m) => ({ default: m.DocumentPage }))
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
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  )
}

export default App
