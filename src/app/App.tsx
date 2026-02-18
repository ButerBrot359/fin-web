import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { Sidebar } from '@/widgets/sidebar'
import { TopBar } from '@/widgets/top-bar'
import { BankPage } from '@/pages/bank'

import { Layout } from './layout/layout'

function App() {
  return (
    <BrowserRouter>
      <Layout sidebar={<Sidebar />} header={<TopBar />}>
        <Routes>
          <Route path="/" element={<div />} />
          <Route path="/bank" element={<BankPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
