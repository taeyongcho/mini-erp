import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { api } from '../api'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [data, setData] = useState({
    customers: [], products: [], quotations: [],
    contracts: [], orders: [], taxes: [],
    receivables: [], payables: [], accounts: []
  })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState([])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [customers, products, quotations, contracts, orders, taxes, receivables, payables, accounts] =
        await Promise.all([
          api.getCustomers(), api.getProducts(), api.getQuotations(),
          api.getContracts(), api.getOrders(), api.getTaxes(),
          api.getReceivables(), api.getPayables(), api.getAccounts()
        ])
      setData({ customers, products, quotations, contracts, orders, taxes, receivables, payables, accounts })
    } finally {
      setLoading(false)
    }
  }, [])

  const showToast = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToast(t => [...t, { id, msg, type }])
    setTimeout(() => setToast(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <DataContext.Provider value={{ data, loading, refresh, toast, showToast }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
