import { useState, useEffect } from 'react'
import { api } from './api'
import { Layout, ToastContainer, Btn, PlanBadge } from './components/UI.jsx'
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
import AdminPage from './pages/AdminPage.jsx'

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

const FREE_DOC_LIMIT = 20

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

  const plan = user.plan || 'free'
  const docCount = data.quotations.length + data.contracts.length + data.orders.length + data.taxes.length

  const userActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.3 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{user.company}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{user.name || user.email}</span>
      </div>
      <PlanBadge plan={plan} />
      {plan === 'free' && (
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
          문서 {docCount}/{FREE_DOC_LIMIT}
        </span>
      )}
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

function loadUser() {
  const raw = localStorage.getItem('erp_user')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    // 구버전(문자열 username) 호환: 잘못된 세션은 로그아웃 처리
    localStorage.removeItem('erp_token')
    localStorage.removeItem('erp_user')
    return null
  }
}

export default function App() {
  const [user, setUser] = useState(loadUser)

  // 로그인 객체에는 plan이 없으므로(로그인 응답엔 미포함) me()로 최신 plan 동기화
  useEffect(() => {
    if (!user || user.role === 'superadmin' || user.plan) return
    api.me().then(u => {
      const merged = { ...user, ...u }
      localStorage.setItem('erp_user', JSON.stringify(merged))
      setUser(merged)
    }).catch(() => {})
  }, [user])

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

  if (user.role === 'superadmin') {
    return (
      <>
        <AdminPage user={user} onLogout={handleLogout} />
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
