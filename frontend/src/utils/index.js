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

// 업체별 견적번호 포맷 생성기
// 템플릿 placeholder: {YYYY} 4자리연도, {YY} 2자리연도, {MM} 월, {seq} 또는 {seq:n} 일련번호(n자리 0채움)
export function formatQuoteNo(template, quotations = []) {
  const now = new Date()
  const yyyy = String(now.getFullYear())
  const yy = yyyy.slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const t = template || 'Q-{YYYY}-{seq}'
  const seqCount = quotations.filter(q => (q.date || '').slice(0, 4) === yyyy).length + 1
  return t
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{seq(?::(\d+))?\}/g, (_, n) => String(seqCount).padStart(n ? +n : 3, '0'))
}

// 품목 정규화: 품목명 있는 행만 남기고 qty/price를 숫자로 변환
export function normalizeItems(items = []) {
  return items
    .filter(i => i.name && i.name.trim())
    .map(i => ({ ...i, qty: Number(i.qty) || 0, price: Number(i.price) || 0 }))
}

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

// 입력 검증
export const isBizNo = v => !v || /^\d{3}-\d{2}-\d{5}$/.test(v)
export const isPhone = v => !v || /^[0-9-]+$/.test(v)
export const isEmail = v => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)

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
