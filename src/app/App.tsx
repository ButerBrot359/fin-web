import { Sidebar } from '@/widgets/sidebar'
import { TopBar } from '@/widgets/top-bar'

import { Layout } from './layout/layout'

function App() {
  return (
    <Layout sidebar={<Sidebar />} header={<TopBar />}>
      {/* page content */}
    </Layout>
  )
}

export default App
