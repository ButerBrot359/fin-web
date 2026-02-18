import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { Sidebar } from '@/widgets/sidebar'
import { TopBar } from '@/widgets/top-bar'
import { BankPage } from '@/pages/bank'
import { CashReceiptOrderPage } from '@/pages/cash-receipt-order'
import { MainPage } from '@/pages/main'

import { Layout } from './layout/layout'

function App() {
  return (
    <BrowserRouter>
      <Layout sidebar={<Sidebar />} header={<TopBar />}>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/bank" element={<BankPage />} />
          <Route
            path="/bank/cash-receipt-order"
            element={<CashReceiptOrderPage />}
          />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
