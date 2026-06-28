import { useState } from 'react'
import { Btn, Badge, Modal, TableWrap, Th, Td, FormGrid, FormGroup, Input, SearchSelect, LineEditor, Summary } from '../components/UI.jsx'
import { api } from '../api.js'
import { useData } from '../context/DataContext.jsx'
import { QUOTATION_STATUSES } from '../constants/index.js'
import { formatQuoteNo, normalizeItems, today, dateAdd, calcItems, exportCSV, fmt, fmtW } from '../utils/index.js'

function printDoc() {
  const content = document.getElementById('print-area').innerHTML
  const win = window.open('', '_blank')
  win.document.write(`
    <html><head>
    <title>문서 출력</title>
    <style>
      body { font-family: 'Noto Sans KR', sans-serif; color: #000; background: #fff; padding: 20px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th, td { border: 1px solid #ccc; padding: 6px 10px; font-size: 12px; }
      th { background: #f5f5f5; }
      h2 { text-align: center; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
      .info-box { border: 1px solid #ccc; padding: 10px; }
      @media print { button { display: none; } }
    </style>
    </head><body>
    ${content}
    <script>window.onload = () => window.print()<\/script>
    </body></html>`)
  win.document.close()
}

const EXPIRE_PRESETS = [3, 5, 7, 14, 30]

export default function QuotationPage({ onNav, renderLayout, user }) {
  const { data, refresh, showToast } = useData()
  const { quotations, customers, products = [] } = data
  const quoteFormat = user?.quote_format || 'Q-{YYYY}-{seq}'

  const saveProduct = async (it) => {
    if (!it.name?.trim()) return showToast('품목명이 비어있습니다','error')
    if (products.some(p => p.name === it.name)) return showToast('이미 등록된 품목입니다','error')
    const code = `PRD-${String(products.length+1).padStart(3,'0')}`
    try {
      await api.createProduct({ code, name: it.name, unit:'개', price: Number(it.price)||0, tax:true })
      await refresh(); showToast(`'${it.name}' 품목관리에 등록되었습니다`)
    } catch(e){ showToast(e.message,'error') }
  }
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [items, setItems] = useState([{name:'',qty:'',price:''}])
  const [saving, setSaving] = useState(false)
  const [sendForm, setSendForm] = useState({ to:'', subject:'', message:'' })
  const [sending, setSending] = useState(false)
  // 매입견적서 불러오기
  const [purchaseItems, setPurchaseItems] = useState([])  // 원본 매입 품목 (참고용)
  const [margin, setMargin] = useState(20)
  const [marginMethod, setMarginMethod] = useState('markup')  // markup | margin
  const [importing, setImporting] = useState(false)

  // 매입가 → 판매가 계산
  const salePrice = (cost, m=margin, method=marginMethod) => {
    const c = Number(cost) || 0
    if (method === 'margin') return m < 100 ? Math.round(c / (1 - m/100)) : c
    return Math.round(c * (1 + m/100))
  }

  // 현재 매입품목 + 마진으로 매출품목 재계산
  const recompute = (m, method) => {
    if (!purchaseItems.length) return
    setItems(purchaseItems.map(p => ({ name: p.name, qty: p.qty || 1, price: salePrice(p.price, m, method) })))
  }

  const uploadPurchase = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const token = localStorage.getItem('erp_token')
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/convert/pdf-to-items', { method:'POST', headers: token?{Authorization:'Bearer '+token}:{}, body: fd })
      if (!r.ok) throw new Error('PDF 변환 실패')
      const d = await r.json()
      const pItems = (d.items||[]).map(it => ({ name: it.name, qty: it.qty||1, price: it.price||0 }))
      if (!pItems.length) { showToast('품목을 추출하지 못했습니다. 직접 입력하세요','error'); return }
      setPurchaseItems(pItems)
      setItems(pItems.map(p => ({ name:p.name, qty:p.qty||1, price: salePrice(p.price) })))
      showToast(`매입견적서에서 ${pItems.length}개 품목을 불러왔습니다`)
    } catch(err){ showToast(err.message,'error') }
    finally { setImporting(false); e.target.value='' }
  }

  // id가 있으면 수정, asCopy면 발송완료 건을 새 번호로 복제
  const openForm = (id, asCopy=false) => {
    setPurchaseItems([])
    const q = id ? quotations.find(x=>x.id===id) : null
    if (q && asCopy) {
      setForm({ ...q, id: formatQuoteNo(quoteFormat, quotations), date: today(), status:'draft' })
      setItems(q.items?.length ? q.items : [{name:'',qty:'',price:''}])
      setModal({mode:'form', id:null})
      return
    }
    setForm(q ? {...q} : { id: formatQuoteNo(quoteFormat, quotations), date: today(), expire: dateAdd(today(),30), customer_id: customers[0]?.id||'', status:'draft', note:'' })
    setItems(q ? (q.items?.length ? q.items : [{name:'',qty:'',price:''}]) : [{name:'',qty:'',price:''}])
    setModal({mode:'form', id})
  }

  const save = async () => {
    if (!form.customer_id) return showToast('거래처를 선택하세요','error')
    const its = normalizeItems(items)
    if (!its.length) return showToast('품목을 입력하세요','error')
    if (form.expire && form.date && form.expire < form.date) return showToast('유효기한은 견적일 이후여야 합니다','error')
    setSaving(true)
    try {
      const payload = {...form, status: form.status||'draft', items: its, customer_id: +form.customer_id}
      if (modal.id) await api.updateQuotation(modal.id, payload)
      else await api.createQuotation(payload)
      showToast(modal.id ? '견적서가 수정되었습니다' : '견적서가 저장되었습니다')
      await refresh(); setModal(null)
    } catch(e) { showToast(e.message,'error') }
    setSaving(false)
  }

  // 발송 모달 열기 (받는사람 기본값 = 거래처 이메일)
  const openSend = (q) => {
    const c = customers.find(x=>x.id===q.customer_id)||{}
    setSendForm({ to: c.email||'', subject:`[${user?.company||''}] 견적서 ${q.id}`, message:'' })
    setModal({mode:'send', id:q.id})
  }

  // 메일 발송 (백엔드가 발송 성공 시 상태를 발송완료로 전환)
  const sendMail = async () => {
    if (!sendForm.to || !sendForm.to.includes('@')) return showToast('받는사람 이메일을 입력하세요','error')
    setSending(true)
    try {
      await api.sendQuotation(modal.id, sendForm)
      showToast('메일이 발송되었습니다')
      await refresh(); setModal(null)
    } catch(e){ showToast(e.message,'error') }
    setSending(false)
  }

  // 메일 없이 발송완료 처리 (SMTP 미설정 시 대체)
  const markSent = async (id) => {
    const q = quotations.find(x=>x.id===id)
    try {
      await api.updateQuotation(id, {...q, status:'sent', customer_id:+q.customer_id})
      showToast('발송완료 처리되었습니다'); await refresh(); setModal(null)
    } catch(e){ showToast(e.message,'error') }
  }

  const del = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    try { await api.deleteQuotation(id); showToast('삭제되었습니다'); await refresh() } catch(e){ showToast(e.message,'error') }
  }

  const convertToContract = (q) => {
    setModal(null)
    onNav('contract')
    sessionStorage.setItem('openContractFromQuote', q.id)
  }

  const convertToOrder = async (q) => {
    const oid = formatQuoteNo('PO-{YYYY}-{seq}', data.orders)
    try {
      await api.createOrder({ id:oid, date:today(), deliver:dateAdd(today(),14), customer_id:+q.customer_id, quotation_id:q.id, status:'ordered', note:`견적 ${q.id} 기반`, items:q.items })
      showToast(`발주서 ${oid} 생성 완료`); await refresh(); onNav('order')
    } catch(e){ showToast(e.message,'error') }
  }

  const viewQ = (id) => setModal({mode:'view', id})
  const q_view = modal?.mode==='view' ? quotations.find(x=>x.id===modal.id) : null
  const c_view = q_view ? customers.find(x=>x.id===q_view.customer_id)||{} : {}

  const filtered = quotations.filter(q => {
    const c = customers.find(x=>x.id===q.customer_id)||{}
    const matchSearch = c.name?.includes(search)||q.id.includes(search)
    const matchFilter = filter==='all'||q.status===filter
    const matchFrom = !dateFrom || q.date >= dateFrom
    const matchTo = !dateTo || q.date <= dateTo
    return matchSearch && matchFilter && matchFrom && matchTo
  })

  const custOpts = customers.map(c=>({value:String(c.id),label:c.name}))

  const doExportCSV = () => {
    exportCSV(`quotations_${today()}.csv`, [
      {key:'id', label:'번호'},
      {key:'date', label:'날짜'},
      {key:'expire', label:'만료일'},
      {key:'customerName', label:'거래처'},
      {key:'statusLabel', label:'상태'},
      {key:'supply', label:'공급가액'},
      {key:'vat', label:'부가세'},
      {key:'total', label:'합계'},
    ], filtered.map(q => {
      const c = customers.find(x=>x.id===q.customer_id)||{}
      const {supply,vat,total} = calcItems(q.items||[])
      const statusLabel = QUOTATION_STATUSES.find(s=>s.value===q.status)?.label || q.status
      return {...q, customerName:c.name, statusLabel, supply, vat, total}
    }))
  }

  return renderLayout(
    <div style={{display:'flex',gap:8}}>
      <Btn onClick={doExportCSV}>CSV 내보내기</Btn>
      <Btn variant="primary" onClick={()=>openForm()}>+ 견적서 작성</Btn>
    </div>,
    <>
      <TableWrap title="견적서 목록" count={quotations.length} searchVal={search} onSearch={setSearch}
        filterEl={
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
              style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'6px 10px',color:'var(--text)',fontSize:12,outline:'none'}} />
            <span style={{color:'var(--muted)',fontSize:12}}>~</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
              style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'6px 10px',color:'var(--text)',fontSize:12,outline:'none'}} />
            <select value={filter} onChange={e=>setFilter(e.target.value)}
              style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'6px 10px',color:'var(--text)',fontSize:12,outline:'none'}}>
              <option value="all">전체</option>
              {QUOTATION_STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        }>
        <thead><tr><Th>견적번호</Th><Th>거래처</Th><Th>견적일</Th><Th>유효기간</Th><Th right>공급가액</Th><Th right>VAT</Th><Th right>합계</Th><Th>상태</Th><Th>액션</Th></tr></thead>
        <tbody>
          {filtered.map(q => {
            const c = customers.find(x=>x.id===q.customer_id)||{}
            const {supply,vat,total} = calcItems(q.items||[])
            const isSent = q.status==='sent'
            return <tr key={q.id}>
              <Td mono accent><span style={{cursor:'pointer'}} onClick={()=>viewQ(q.id)}>{q.id}</span></Td>
              <Td>{c.name}</Td><Td>{q.date}</Td><Td>{q.expire}</Td>
              <Td right>{fmt(supply)}</Td><Td right>{fmt(vat)}</Td><Td right accent>{fmtW(total)}</Td>
              <Td><Badge status={q.status}/></Td>
              <Td><div style={{display:'flex',gap:4}}>
                {!isSent && <>
                  <Btn size="sm" onClick={()=>openForm(q.id)}>수정</Btn>
                  <Btn size="sm" variant="primary" onClick={()=>openSend(q)}>발송</Btn>
                  <Btn size="sm" variant="danger" onClick={()=>del(q.id)}>삭제</Btn>
                </>}
                {isSent && <>
                  <Btn size="sm" onClick={()=>openForm(q.id, true)}>수정(복제)</Btn>
                  <Btn size="sm" variant="success" onClick={()=>convertToContract(q)}>계약전환</Btn>
                  <Btn size="sm" variant="warn" onClick={()=>convertToOrder(q)}>발주전환</Btn>
                  <Btn size="sm" variant="danger" onClick={()=>del(q.id)}>삭제</Btn>
                </>}
              </div></Td>
            </tr>
          })}
          {filtered.length===0&&<tr><td colSpan={9} style={{textAlign:'center',padding:30,color:'var(--muted)'}}>견적서가 없습니다</td></tr>}
        </tbody>
      </TableWrap>

      {/* Form Modal */}
      <Modal open={modal?.mode==='form'} onClose={()=>setModal(null)} title={modal?.id?'견적서 수정':'견적서 작성'} wide>
        <FormGrid>
          <FormGroup label="견적번호"><Input value={form.id} readOnly mono /></FormGroup>
          <FormGroup label="거래처"><SearchSelect value={String(form.customer_id||'')} onChange={v=>setForm(f=>({...f,customer_id:v}))} options={custOpts} placeholder="거래처명 검색" /></FormGroup>
          <FormGroup label="견적일"><Input type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))} /></FormGroup>
          <FormGroup label="유효기간">
            <Input type="date" value={form.expire} onChange={v=>setForm(f=>({...f,expire:v}))} />
            <div style={{display:'flex',gap:4,marginTop:6,flexWrap:'wrap'}}>
              {EXPIRE_PRESETS.map(n=>(
                <Btn key={n} size="sm" onClick={()=>setForm(f=>({...f,expire:dateAdd(f.date||today(),n)}))}>{n}일</Btn>
              ))}
            </div>
          </FormGroup>
          <FormGroup label="비고" full><Input value={form.note} onChange={v=>setForm(f=>({...f,note:v}))} /></FormGroup>
        </FormGrid>
        {/* 매입견적서 불러오기 */}
        <div style={{marginTop:20,padding:16,background:'var(--surface2)',border:'1px dashed var(--border)',borderRadius:8}}>
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <span style={{fontSize:12,fontWeight:600,color:'var(--label)'}}>📥 매입견적서 불러오기</span>
            <label style={{cursor:'pointer'}}>
              <span style={{display:'inline-block',padding:'6px 12px',background:'var(--accent)',color:'#fff',borderRadius:6,fontSize:12}}>{importing?'변환 중...':'PDF 업로드'}</span>
              <input type="file" accept=".pdf" onChange={uploadPurchase} disabled={importing} style={{display:'none'}} />
            </label>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontSize:12,color:'var(--muted)'}}>마진율</span>
              <input type="number" value={margin} onChange={e=>{const m=+e.target.value||0; setMargin(m); recompute(m, marginMethod)}}
                style={{width:60,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:6,padding:'6px 8px',color:'var(--text)',fontFamily:'var(--mono)',fontSize:12,textAlign:'right',outline:'none'}} />
              <span style={{fontSize:12,color:'var(--muted)'}}>%</span>
            </div>
            <div style={{display:'flex',gap:4,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:6,padding:3}}>
              {[['markup','마크업'],['margin','마진율']].map(([v,l])=>(
                <button key={v} onClick={()=>{setMarginMethod(v); recompute(margin, v)}}
                  style={{padding:'4px 10px',borderRadius:4,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,
                    background: marginMethod===v?'var(--accent)':'transparent', color: marginMethod===v?'#fff':'var(--label)'}}>{l}</button>
              ))}
            </div>
          </div>
          {purchaseItems.length>0 && (
            <div style={{marginTop:12}}>
              <div style={{fontSize:11,color:'var(--muted)',marginBottom:6}}>원본 매입가 (참고) — {marginMethod==='markup'?'판매가=매입가×(1+마진율)':'판매가=매입가÷(1−마진율)'}</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                <thead><tr>{['품목명','매입가','→ 판매가'].map((h,i)=><th key={i} style={{padding:'4px 8px',textAlign:i?'right':'left',color:'var(--muted)',borderBottom:'1px solid var(--border)'}}>{h}</th>)}</tr></thead>
                <tbody>{purchaseItems.map((p,i)=><tr key={i}><td style={{padding:'4px 8px'}}>{p.name}</td><td style={{padding:'4px 8px',textAlign:'right',fontFamily:'var(--mono)',color:'var(--muted)'}}>{fmt(p.price)}</td><td style={{padding:'4px 8px',textAlign:'right',fontFamily:'var(--mono)',color:'var(--accent2)'}}>{fmt(salePrice(p.price))}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>

        <LineEditor items={items} onChange={setItems} products={products} onSaveProduct={saveProduct} />
        <Summary items={items} />
        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
          <Btn onClick={()=>setModal(null)}>취소</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving?'저장 중...':'저장'}</Btn>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal open={modal?.mode==='view'} onClose={()=>setModal(null)} title="견적서 상세" wide>
        {q_view && (() => {
          const {supply,vat,total}=calcItems(q_view.items||[])
          const isSent = q_view.status==='sent'
          return <>
            <div id="print-area" style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:24}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
                <div><h1 style={{fontSize:22,fontWeight:700}}>견적서</h1><div style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--accent)'}}>{q_view.id}</div></div>
                <Badge status={q_view.status}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20,padding:16,background:'var(--surface)',borderRadius:6,border:'1px solid var(--border)'}}>
                <div>
                  <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:8}}>공급자</div>
                  {[['상호',user?.company||'-'],['견적일',q_view.date],['유효기간',q_view.expire]].map(([k,v])=><div key={k} style={{display:'flex',gap:8,fontSize:12,marginBottom:4}}><span style={{color:'var(--muted)',minWidth:70}}>{k}</span><span>{v}</span></div>)}
                </div>
                <div>
                  <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:8}}>공급받는자</div>
                  {[['상호',c_view.name],['대표자',c_view.ceo],['사업자번호',c_view.biz_no],['주소',c_view.addr]].map(([k,v])=><div key={k} style={{display:'flex',gap:8,fontSize:12,marginBottom:4}}><span style={{color:'var(--muted)',minWidth:70}}>{k}</span><span>{v}</span></div>)}
                </div>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['#','품목명','수량','단가','금액'].map((h,i)=><th key={i} style={{padding:'8px 10px',fontSize:10,color:'var(--muted)',textAlign:i>=2?'right':'left',borderBottom:'1px solid var(--border)',background:'var(--surface)'}}>{h}</th>)}</tr></thead>
                <tbody>{(q_view.items||[]).map((it,i)=><tr key={i}><td style={{padding:'10px',fontFamily:'var(--mono)',color:'var(--muted)',fontSize:12}}>{String(i+1).padStart(2,'0')}</td><td style={{padding:'10px',fontSize:12}}>{it.name}</td><td style={{padding:'10px',fontFamily:'var(--mono)',textAlign:'right',fontSize:12}}>{it.qty}</td><td style={{padding:'10px',fontFamily:'var(--mono)',textAlign:'right',fontSize:12}}>{fmt(it.price)}</td><td style={{padding:'10px',fontFamily:'var(--mono)',textAlign:'right',fontSize:12,color:'var(--accent)'}}>{fmt((it.qty||0)*(it.price||0))}</td></tr>)}</tbody>
              </table>
              <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}>
                <div style={{minWidth:280,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:16}}>
                  {[['공급가액',fmtW(supply)],['부가세',fmtW(vat)]].map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:12}}><span style={{color:'var(--label)'}}>{k}</span><span style={{fontFamily:'var(--mono)'}}>{v}</span></div>)}
                  <div style={{borderTop:'1px solid var(--border)',marginTop:8,paddingTop:8,display:'flex',justifyContent:'space-between',fontWeight:700,color:'var(--accent)',fontFamily:'var(--mono)',fontSize:15}}><span style={{fontSize:12,color:'var(--label)',fontFamily:'var(--sans)',fontWeight:400}}>합계</span>{fmtW(total)}</div>
                </div>
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:20}}>
              <Btn onClick={()=>setModal(null)}>닫기</Btn>
              <Btn onClick={printDoc}>🖨️ 인쇄/PDF</Btn>
              {!isSent && <Btn variant="primary" onClick={()=>openForm(q_view.id)}>수정</Btn>}
              {!isSent && <Btn variant="success" onClick={()=>openSend(q_view)}>발송</Btn>}
              {isSent && <Btn onClick={()=>openForm(q_view.id, true)}>수정(복제)</Btn>}
              {isSent && <Btn variant="success" onClick={()=>convertToContract(q_view)}>계약서 전환</Btn>}
              {isSent && <Btn variant="warn" onClick={()=>{setModal(null);convertToOrder(q_view)}}>발주서 전환</Btn>}
            </div>
          </>
        })()}
      </Modal>

      {/* Send Modal */}
      <Modal open={modal?.mode==='send'} onClose={()=>setModal(null)} title="견적서 메일 발송">
        {!user?.smtp_configured && (
          <div style={{background:'rgba(245,158,11,.1)',border:'1px solid rgba(245,158,11,.3)',borderRadius:8,padding:'12px 14px',marginBottom:16,fontSize:12,color:'var(--warn)'}}>
            ⚠️ 메일(SMTP) 설정이 안 되어 있습니다. <b>내 정보 → 메일(SMTP) 설정</b>을 먼저 완료하면 실제 메일이 발송됩니다.<br/>
            지금은 메일 없이 '발송완료'로 상태만 변경할 수 있습니다.
          </div>
        )}
        <FormGrid cols={1}>
          <FormGroup label="받는사람 이메일"><Input type="email" value={sendForm.to} onChange={v=>setSendForm(f=>({...f,to:v}))} placeholder="customer@example.com" /></FormGroup>
          <FormGroup label="제목"><Input value={sendForm.subject} onChange={v=>setSendForm(f=>({...f,subject:v}))} /></FormGroup>
          <FormGroup label="메시지 (선택)"><Input value={sendForm.message} onChange={v=>setSendForm(f=>({...f,message:v}))} placeholder="안녕하세요, 견적서를 보내드립니다." /></FormGroup>
        </FormGrid>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
          <Btn onClick={()=>setModal(null)}>취소</Btn>
          <Btn onClick={()=>markSent(modal.id)}>메일 없이 발송완료</Btn>
          <Btn variant="primary" onClick={sendMail} disabled={sending||!user?.smtp_configured}>{sending?'발송 중...':'메일 발송'}</Btn>
        </div>
      </Modal>
    </>
  )
}
