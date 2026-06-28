import { useState } from 'react'
import { Layout, ToastContainer, Btn } from './components/UI.jsx'
import { DataProvider, useData } from './context/DataContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import QuotationPage from './pages/QuotationPage.jsx'
import ContractPage from './pages/ContractPage.jsx'
import OrderPage from './pages/OrderPage.jsx'
import TaxPage from './pages/TaxPage.jsx'
import CustomerPage from './pages/CustomerPage.jsx'
import ProductPage from './pages/ProductPage.jsx'
import ReceivablePage from './pages/ReceivablePage.jsx'
import PayablePage from './pages/PayablePage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import ConvertPage from './pages/ConvertPage.jsx'
import LoginPage from './pages/LoginPage.jsx'

const pages = {
  dashboard: Dashboard,
  quotation: QuotationPage,
  contract: ContractPage,
  order: OrderPage,
  tax: TaxPage,
  customer: CustomerPage,
  product: ProductPage,
  receivable: ReceivablePage,
  payable: PayablePage,
  account: AccountPage,
  convert: ConvertPage,
}

function AppInner({ user, onLogout }) {
  const [page, setPage] = useState('dashboard')
  const { data, loading } = useData()

  const badges = {
    quotation: data.quotations.filter(q => q.status === 'sent').length,
    contract: data.contracts.filter(c => c.status === 'waiting_sign').length,
    order: data.orders.filter(o => o.status === 'ordered').length,
    tax: data.taxes.filter(t => t.status === 'pending').length,
    receivable: (data.receivables || []).filter(r => r.status !== 'settled').length,
    payable: (data.payables || []).filter(p => p.status !== 'settled').length,
  }

  const Page = pages[page] || Dashboard

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)', fontFamily: 'var(--sans)' }}>
        서버 연결 중...
      </div>
    )
  }

  const userActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{user}</span>
      <Btn variant="secondary" size="sm" onClick={onLogout}>로그아웃</Btn>
    </div>
  )

  return (
    <Page
      onNav={setPage}
      renderLayout={(actions, children) => (
        <Layout page={page} onNav={setPage} topbarActions={<>{actions}{userActions}</>} badges={badges}>
          {children}
        </Layout>
      )}
    />
  )
}

export default function App() {
  const [user, setUser] = useState(localStorage.getItem('erp_user'))

  function handleLogout() {
    localStorage.removeItem('erp_token')
    localStorage.removeItem('erp_user')
    setUser(null)
  }

  if (!user) {
    return (
      <>
        <LoginPage onLogin={u => setUser(u)} />
        <ToastContainer />
      </>
    )
  }

  return (
    <DataProvider>
      <AppInner user={user} onLogout={handleLogout} />
      <ToastContainer />
    </DataProvider>
  )
}
