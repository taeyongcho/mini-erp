const BASE = '/api'

async function req(method, path, body) {
  const token = localStorage.getItem('erp_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = 'Bearer ' + token
  const opts = { method, headers }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const r = await fetch(BASE + path, opts)
  // 로그인/회원가입 요청은 인증 흐름의 일부이므로 401 자동 로그아웃에서 제외
  const isAuthAttempt = path === '/auth/login' || path === '/auth/signup'
  if (r.status === 401 && !isAuthAttempt) {
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
  // 인증
  signup: (d) => req('POST', '/auth/signup', d),
  login: (d) => req('POST', '/auth/login', d),
  me: () => req('GET', '/auth/me'),
  updateProfile: (d) => req('PUT', '/auth/profile', d),
  changePassword: (d) => req('PUT', '/auth/password', d),
  // 슈퍼어드민
  getCompanies: () => req('GET', '/admin/companies'),
  setCompanyPlan: (id, plan) => req('PATCH', '/admin/companies/' + id + '/plan', { plan }),
  toggleCompanyActive: (id) => req('PATCH', '/admin/companies/' + id + '/active'),

  getCustomers: () => req('GET', '/customers'),
  createCustomer: (d) => req('POST', '/customers', d),
  updateCustomer: (id, d) => req('PUT', `/customers/${id}`, d),
  deleteCustomer: (id) => req('DELETE', `/customers/${id}`),

  getProducts: () => req('GET', '/products'),
  createProduct: (d) => req('POST', '/products', d),
  updateProduct: (id, d) => req('PUT', `/products/${id}`, d),
  deleteProduct: (id) => req('DELETE', `/products/${id}`),

  sendQuotation: (id, d) => req('POST', `/quotations/${id}/send`, d),
  getQuotations: () => req('GET', '/quotations'),
  createQuotation: (d) => req('POST', '/quotations', d),
  updateQuotation: (id, d) => req('PUT', `/quotations/${id}`, d),
  deleteQuotation: (id) => req('DELETE', `/quotations/${id}`),

  getContracts: () => req('GET', '/contracts'),
  createContract: (d) => req('POST', '/contracts', d),
  updateContract: (id, d) => req('PUT', `/contracts/${id}`, d),
  updateContractStatus: (id, status) => req('PATCH', `/contracts/${id}/status`, { status }),
  sendContract: (id, d) => req('POST', `/contracts/${id}/send`, d),
  deleteContract: (id) => req('DELETE', `/contracts/${id}`),

  sendOrder: (id, d) => req('POST', `/orders/${id}/send`, d),
  getOrders: () => req('GET', '/orders'),
  createOrder: (d) => req('POST', '/orders', d),
  updateOrder: (id, d) => req('PUT', `/orders/${id}`, d),
  deleteOrder: (id) => req('DELETE', `/orders/${id}`),

  sendTax: (id, d) => req('POST', `/taxes/${id}/send`, d),
  getTaxes: () => req('GET', '/taxes'),
  createTax: (d) => req('POST', '/taxes', d),
  updateTax: (id, d) => req('PUT', `/taxes/${id}`, d),
  issueTax: (id) => req('PATCH', `/taxes/${id}/issue`, {}),
  deleteTax: (id) => req('DELETE', `/taxes/${id}`),

  getReceivables: () => req('GET', '/receivables'),
  createReceivable: (d) => req('POST', '/receivables', d),
  settleReceivable: (id, d) => req('PATCH', '/receivables/' + id + '/settle', d),
  deleteReceivable: (id) => req('DELETE', '/receivables/' + id),
  getPayables: () => req('GET', '/payables'),
  createPayable: (d) => req('POST', '/payables', d),
  settlePayable: (id, d) => req('PATCH', '/payables/' + id + '/settle', d),
  deletePayable: (id) => req('DELETE', '/payables/' + id),
  getAccounts: () => req('GET', '/accounts'),
  createAccount: (d) => req('POST', '/accounts', d),
  updateAccount: (id, d) => req('PUT', '/accounts/' + id, d),
  deleteAccount: (id) => req('DELETE', '/accounts/' + id),
}
