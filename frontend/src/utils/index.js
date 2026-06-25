// 숫자 포맷
export function fmt(n) {
  return Number(n || 0).toLocaleString()
}
export function fmtW(n) {
  return fmt(n) + '원'
}

// 공통 ID 생성기
export function generateId(prefix, list, field = 'id') {
  const year = new Date().getFullYear()
  const same = list.filter(x => x[field]?.startsWith(prefix + '-' + year))
  const seq = String(same.length + 1).padStart(3, '0')
  return `${prefix}-${year}-${seq}`
}
// 사용 예:
// generateId('Q', quotations)   → 'Q-2025-001'
// generateId('CT', contracts)   → 'CT-2025-001'
// generateId('PO', orders)      → 'PO-2025-001'
// generateId('TAX', taxes)      → 'TAX-2025-001'

// 날짜
export function today() {
  return new Date().toISOString().slice(0, 10)
}
export function dateAdd(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// 금액 계산
export function calcItems(items = []) {
  const supply = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
  const vat = Math.round(supply * 0.1)
  return { supply, vat, total: supply + vat }
}

// CSV 내보내기
export function exportCSV(filename, headers, rows) {
  // headers: [{key, label}]
  // rows: array of objects
  const BOM = '﻿'
  const head = headers.map(h => h.label).join(',')
  const body = rows.map(r => headers.map(h => {
    const v = r[h.key] ?? ''
    return typeof v === 'string' && v.includes(',') ? `"${v}"` : v
  }).join(',')).join('\n')
  const blob = new Blob([BOM + head + '\n' + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
