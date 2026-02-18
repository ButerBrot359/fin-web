import { Sidebar } from '@/widgets/sidebar'

import { Layout } from './layout/layout'

function App() {
  return <Layout sidebar={<Sidebar />}>{/* page content */}</Layout>
}

export default App
