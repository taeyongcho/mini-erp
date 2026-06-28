import { useState, useRef } from 'react'
import { Btn, FormGrid, FormGroup, Input, LineEditor, fmtW } from '../components/UI.jsx'
import { exportCSV, today } from '../utils/index.js'

export default function ConvertPage({ renderLayout }) {
  const [items, setItems] = useState([])
  const [rawText, setRawText] = useState('')
  const [margin, setMargin] = useState(30)
  const [loading, setLoading] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [manager, setManager] = useState('')
  const [projectName, setProjectName] = useState('')
  const fileRef = useRef()

  const sellItems = items.map(it => {
    const buy = Number(it.price) || 0
    const sell = margin > 0 ? Math.round(buy / (1 - margin / 100)) : buy
    return { ...it, sell_price: sell }
  })

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const token = localStorage.getItem('erp_token')
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/convert/pdf-to-items', {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: fd,
      })
      if (!r.ok) throw new Error('변환 실패')
      const data = await r.json()
      setItems(data.items || [])
      setRawText(data.raw_text || '')
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handlePrint() {
    const supply = sellItems.reduce((s, it) => s + (it.qty || 0) * (it.sell_price || 0), 0)
    const vat = Math.round(supply * 0.1)
    const total = supply + vat
    const rows = sellItems.map(it => `
      <tr>
        <td>${it.name}</td>
        <td style="text-align:center">${it.unit || '식'}</td>
        <td style="text-align:right">${it.qty || 1}</td>
        <td style="text-align:right">${(it.sell_price || 0).toLocaleString('ko-KR')}</td>
        <td style="text-align:right">${((it.qty || 1) * (it.sell_price || 0)).toLocaleString('ko-KR')}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>견적서</title>
<style>body{font-family:sans-serif;font-size:13px;margin:30px}h2{text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px}th{background:#f0f0f0}</style>
</head><body>
<h2>견 적 서</h2>
<p>수신: ${customerName || ''} &nbsp; 담당: ${manager || ''} &nbsp; 건명: ${projectName || ''}</p>
<table><thead><tr><th>품목명</th><th>단위</th><th>수량</th><th>단가</th><th>금액</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="4" style="text-align:right;font-weight:bold">공급가액</td><td style="text-align:right">${supply.toLocaleString('ko-KR')}</td></tr>
<tr><td colspan="4" style="text-align:right;font-weight:bold">부가세</td><td style="text-align:right">${vat.toLocaleString('ko-KR')}</td></tr>
<tr><td colspan="4" style="text-align:right;font-weight:bold">합계</td><td style="text-align:right;font-weight:bold">${total.toLocaleString('ko-KR')}</td></tr></tfoot>
</table></body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.print()
  }

  function handleExcel() {
    exportCSV('견적서.csv', [
      { key: 'name', label: '품목명' },
      { key: 'unit', label: '단위' },
      { key: 'qty', label: '수량' },
      { key: 'price', label: '매입단가' },
      { key: 'sell_price', label: '판매단가' },
    ], sellItems)
  }

  const supply = sellItems.reduce((s, it) => s + (it.qty || 0) * (it.sell_price || 0), 0)
  const vat = Math.round(supply * 0.1)

  return renderLayout(
    <div style={{ display:'flex', gap:8 }}>
      {items.length > 0 && (
        <>
          <Btn variant="secondary" onClick={handlePrint}>인쇄/PDF</Btn>
          <Btn variant="secondary" onClick={handleExcel}>Excel 다운로드</Btn>
        </>
      )}
    </div>,
    <div>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:24, marginBottom:20 }}>
        <h3 style={{ fontSize:13, fontWeight:600, marginBottom:16 }}>PDF 파일 업로드</h3>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <input ref={fileRef} type="file" accept=".pdf" onChange={handleUpload}
            style={{ fontSize:13, color:'var(--text)', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 12px' }} />
          {loading && <span style={{ fontSize:12, color:'var(--muted)' }}>파싱 중...</span>}
        </div>
        {rawText && (
          <details style={{ marginTop:12 }}>
            <summary style={{ fontSize:11, color:'var(--muted)', cursor:'pointer' }}>원본 텍스트 보기</summary>
            <pre style={{ fontSize:11, color:'var(--muted)', marginTop:8, maxHeight:200, overflowY:'auto', background:'var(--surface2)', padding:10, borderRadius:6 }}>{rawText}</pre>
          </details>
        )}
      </div>

      {items.length > 0 && (
        <>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:24, marginBottom:20 }}>
            <h3 style={{ fontSize:13, fontWeight:600, marginBottom:16 }}>견적 정보</h3>
            <FormGrid cols={3}>
              <FormGroup label="고객사명">
                <Input value={customerName} onChange={setCustomerName} placeholder="고객사명" />
              </FormGroup>
              <FormGroup label="담당자">
                <Input value={manager} onChange={setManager} placeholder="홍길동" />
              </FormGroup>
              <FormGroup label="사업명">
                <Input value={projectName} onChange={setProjectName} placeholder="사업명" />
              </FormGroup>
            </FormGrid>
            <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:12 }}>
              <label style={{ fontSize:12, color:'var(--label)' }}>마진율 (%)</label>
              <input type="number" value={margin} onChange={e => setMargin(Number(e.target.value))} min={0} max={99}
                style={{ width:80, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 10px', color:'var(--text)', fontFamily:'var(--sans)', fontSize:13, outline:'none' }} />
              <span style={{ fontSize:12, color:'var(--muted)' }}>판매가 = 매입가 / (1 - 마진율/100)</span>
            </div>
          </div>

          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:24, marginBottom:20 }}>
            <h3 style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>추출된 품목 (수정 가능)</h3>
            <LineEditor items={items} onChange={setItems} />
            <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              <div style={{ background:'var(--surface2)', borderRadius:8, padding:12 }}>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>공급가액</div>
                <div style={{ fontFamily:'var(--mono)', color:'var(--accent)', fontSize:15 }}>{fmtW(supply)}</div>
              </div>
              <div style={{ background:'var(--surface2)', borderRadius:8, padding:12 }}>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>부가세</div>
                <div style={{ fontFamily:'var(--mono)', color:'var(--text)', fontSize:15 }}>{fmtW(vat)}</div>
              </div>
              <div style={{ background:'var(--surface2)', borderRadius:8, padding:12 }}>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>합계</div>
                <div style={{ fontFamily:'var(--mono)', color:'var(--accent2)', fontSize:15 }}>{fmtW(supply + vat)}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
