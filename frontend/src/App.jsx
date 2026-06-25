import { useState, useEffect, useCallback } from 'react'
import { Layout, ToastContainer, toast } from './components/UI.jsx'
import Dashboard from './pages/Dashboard.jsx'
import QuotationPage from './pages/QuotationPage.jsx'
import ContractPage from './pages/ContractPage.jsx'
import OrderPage from './pages/OrderPage.jsx'
import TaxPage from './pages/TaxPage.jsx'
import CustomerPage from './pages/CustomerPage.jsx'
import ProductPage from './pages/ProductPage.jsx'
import { api } from './api.js'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [data, setData] = useState({ customers:[], products:[], quotations:[], contracts:[], orders:[], taxes:[] })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [customers, products, quotations, contracts, orders, taxes] = await Promise.all([
        api.getCustomers(), api.getProducts(), api.getQuotations(),
        api.getContracts(), api.getOrders(), api.getTaxes()
      ])
      setData({ customers, products, quotations, contracts, orders, taxes })
    } catch(e) { toast('서버 연결 오류: '+e.message, 'error') }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const badges = {
    quotation: data.quotations.filter(q=>q.status==='sent').length,
    contract: data.contracts.filter(c=>c.status==='waiting_sign').length,
    order: data.orders.filter(o=>o.status==='ordered').length,
    tax: data.taxes.filter(t=>t.status==='pending').length,
  }

  const pages = {
    dashboard: Dashboard,
    quotation: QuotationPage,
    contract: ContractPage,
    order: OrderPage,
    tax: TaxPage,
    customer: CustomerPage,
    product: ProductPage,
  }
  const Page = pages[page] || Dashboard

  return (
    <>
      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--muted)', fontFamily:'var(--sans)' }}>
          서버 연결 중...
        </div>
      ) : (
        <Page data={data} refresh={refresh} onNav={setPage}
          renderLayout={(actions, children) => (
            <Layout page={page} onNav={setPage} topbarActions={actions} badges={badges}>{children}</Layout>
          )} />
      )}
      <ToastContainer />
    </>
  )
}
