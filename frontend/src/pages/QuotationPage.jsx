import { useState } from 'react'
import { Btn, Badge, Modal, TableWrap, Th, Td, FormGrid, FormGroup, Input, Select, LineEditor, Summary } from '../components/UI.jsx'
import { api } from '../api.js'
import { useData } from '../context/DataContext.jsx'
import { QUOTATION_STATUSES } from '../constants/index.js'
import { generateId, today, dateAdd, calcItems, exportCSV, fmt, fmtW } from '../utils/index.js'

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

export default function QuotationPage({ onNav, renderLayout }) {
  const { data, refresh, showToast } = useData()
  const { quotations, customers } = data
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [items, setItems] = useState([{name:'',qty:1,price:0,unit:'개'}])
  const [saving, setSaving] = useState(false)

  const openForm = (id) => {
    const q = id ? quotations.find(x=>x.id===id) : null
    setForm(q ? {...q} : { id: generateId('Q', quotations), date: today(), expire: dateAdd(today(),30), customer_id: customers[0]?.id||'', status:'draft', note:'' })
    setItems(q ? (q.items||[]) : [{name:'',qty:1,price:0,unit:'개'}])
    setModal({mode:'form', id})
  }

  const save = async () => {
    if (!form.customer_id) return showToast('거래처를 선택하세요','error')
    if (!items.some(i=>i.name)) return showToast('품목을 입력하세요','error')
    if (form.expire && form.date && form.expire < form.date) return showToast('유효기한은 견적일 이후여야 합니다','error')
    setSaving(true)
    try {
      const payload = {...form, items: items.filter(i=>i.name), customer_id: +form.customer_id}
      if (modal.id) await api.updateQuotation(modal.id, payload)
      else await api.createQuotation(payload)
      showToast(modal.id ? '견적서가 수정되었습니다' : '견적서가 저장되었습니다')
      await refresh(); setModal(null)
    } catch(e) { showToast(e.message,'error') }
    setSaving(false)
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
    const oid = generateId('PO', data.orders)
    try {
      await api.createOrder({ id:oid, date:today(), deliver:dateAdd(today(),14), customer_id:q.customer_id, quotation_id:q.id, status:'ordered', note:`견적 ${q.id} 기반`, items:q.items })
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
            return <tr key={q.id}>
              <Td mono accent><span style={{cursor:'pointer'}} onClick={()=>viewQ(q.id)}>{q.id}</span></Td>
              <Td>{c.name}</Td><Td>{q.date}</Td><Td>{q.expire}</Td>
              <Td right>{fmt(supply)}</Td><Td right>{fmt(vat)}</Td><Td right accent>{fmtW(total)}</Td>
              <Td><Badge status={q.status}/></Td>
              <Td><div style={{display:'flex',gap:4}}>
                <Btn size="sm" onClick={()=>openForm(q.id)}>수정</Btn>
                {q.status==='approved'&&<Btn size="sm" variant="success" onClick={()=>convertToContract(q)}>계약전환</Btn>}
                {q.status==='approved'&&<Btn size="sm" variant="warn" onClick={()=>convertToOrder(q)}>발주전환</Btn>}
                <Btn size="sm" variant="danger" onClick={()=>del(q.id)}>삭제</Btn>
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
          <FormGroup label="거래처"><Select value={String(form.customer_id||'')} onChange={v=>setForm(f=>({...f,customer_id:v}))} options={custOpts} /></FormGroup>
          <FormGroup label="견적일"><Input type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))} /></FormGroup>
          <FormGroup label="유효기간"><Input type="date" value={form.expire} onChange={v=>setForm(f=>({...f,expire:v}))} /></FormGroup>
          <FormGroup label="상태"><Select value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={QUOTATION_STATUSES} /></FormGroup>
          <FormGroup label="비고"><Input value={form.note} onChange={v=>setForm(f=>({...f,note:v}))} /></FormGroup>
        </FormGrid>
        <LineEditor items={items} onChange={setItems} />
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
          return <>
            <div id="print-area" style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:24}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
                <div><h1 style={{fontSize:22,fontWeight:700}}>견적서</h1><div style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--accent)'}}>{q_view.id}</div></div>
                <Badge status={q_view.status}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20,padding:16,background:'var(--surface)',borderRadius:6,border:'1px solid var(--border)'}}>
                <div>
                  <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:8}}>공급자</div>
                  {[['상호','Axiosoft (주)'],['견적일',q_view.date],['유효기간',q_view.expire]].map(([k,v])=><div key={k} style={{display:'flex',gap:8,fontSize:12,marginBottom:4}}><span style={{color:'var(--muted)',minWidth:70}}>{k}</span><span>{v}</span></div>)}
                </div>
                <div>
                  <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:8}}>공급받는자</div>
                  {[['상호',c_view.name],['대표자',c_view.ceo],['사업자번호',c_view.biz_no],['주소',c_view.addr]].map(([k,v])=><div key={k} style={{display:'flex',gap:8,fontSize:12,marginBottom:4}}><span style={{color:'var(--muted)',minWidth:70}}>{k}</span><span>{v}</span></div>)}
                </div>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['#','품목명','단위','수량','단가','금액'].map((h,i)=><th key={i} style={{padding:'8px 10px',fontSize:10,color:'var(--muted)',textAlign:i>=3?'right':'left',borderBottom:'1px solid var(--border)',background:'var(--surface)'}}>{h}</th>)}</tr></thead>
                <tbody>{(q_view.items||[]).map((it,i)=><tr key={i}><td style={{padding:'10px',fontFamily:'var(--mono)',color:'var(--muted)',fontSize:12}}>{String(i+1).padStart(2,'0')}</td><td style={{padding:'10px',fontSize:12}}>{it.name}</td><td style={{padding:'10px',fontSize:12}}>{it.unit}</td><td style={{padding:'10px',fontFamily:'var(--mono)',textAlign:'right',fontSize:12}}>{it.qty}</td><td style={{padding:'10px',fontFamily:'var(--mono)',textAlign:'right',fontSize:12}}>{fmt(it.price)}</td><td style={{padding:'10px',fontFamily:'var(--mono)',textAlign:'right',fontSize:12,color:'var(--accent)'}}>{fmt((it.qty||0)*(it.price||0))}</td></tr>)}</tbody>
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
              <Btn variant="primary" onClick={()=>openForm(q_view.id)}>수정</Btn>
              {q_view.status==='approved'&&<Btn variant="success" onClick={()=>convertToContract(q_view)}>계약서 전환</Btn>}
              {q_view.status==='approved'&&<Btn variant="warn" onClick={()=>{setModal(null);convertToOrder(q_view)}}>발주서 전환</Btn>}
            </div>
          </>
        })()}
      </Modal>
    </>
  )
}
