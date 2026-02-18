import { Sidebar } from '@/widgets/sidebar'
import { TopBar } from '@/widgets/top-bar'
import { PageToolbar } from '@/features/page-toolbar'

import { Layout } from './layout/layout'

function App() {
  return (
    <Layout
      sidebar={<Sidebar />}
      header={
        <>
          <TopBar />
          <PageToolbar title="Банк и касса" />
        </>
      }
    >
      {/* page content */}
    </Layout>
  )
}

export default App
