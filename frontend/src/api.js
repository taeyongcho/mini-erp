const BASE = '/api'

async function req(method, path, body) {
  const token = localStorage.getItem('erp_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = 'Bearer ' + token
  const opts = { method, headers }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const r = await fetch(BASE + path, opts)
  if (r.status === 401) {
    localStorage.removeItem('erp_token')
    localStorage.removeItem('erp_user')
    window.location.reload()
    return
  }
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${r.status}`)
  }
  return r.json()
}

export const api = {
  getCustomers: () => req('GET', '/customers'),
  createCustomer: (d) => req('POST', '/customers', d),
  updateCustomer: (id, d) => req('PUT', `/customers/${id}`, d),
  deleteCustomer: (id) => req('DELETE', `/customers/${id}`),

  getProducts: () => req('GET', '/products'),
  createProduct: (d) => req('POST', '/products', d),
  updateProduct: (id, d) => req('PUT', `/products/${id}`, d),
  deleteProduct: (id) => req('DELETE', `/products/${id}`),

  getQuotations: () => req('GET', '/quotations'),
  createQuotation: (d) => req('POST', '/quotations', d),
  updateQuotation: (id, d) => req('PUT', `/quotations/${id}`, d),
  deleteQuotation: (id) => req('DELETE', `/quotations/${id}`),

  getContracts: () => req('GET', '/contracts'),
  createContract: (d) => req('POST', '/contracts', d),
  updateContract: (id, d) => req('PUT', `/contracts/${id}`, d),
  updateContractStatus: (id, status) => req('PATCH', `/contracts/${id}/status`, { status }),
  deleteContract: (id) => req('DELETE', `/contracts/${id}`),

  getOrders: () => req('GET', '/orders'),
  createOrder: (d) => req('POST', '/orders', d),
  updateOrder: (id, d) => req('PUT', `/orders/${id}`, d),
  deleteOrder: (id) => req('DELETE', `/orders/${id}`),

  getTaxes: () => req('GET', '/taxes'),
  createTax: (d) => req('POST', '/taxes', d),
  updateTax: (id, d) => req('PUT', `/taxes/${id}`, d),
  issueTax: (id) => req('PATCH', `/taxes/${id}/issue`, {}),
  deleteTax: (id) => req('DELETE', `/taxes/${id}`),
}
