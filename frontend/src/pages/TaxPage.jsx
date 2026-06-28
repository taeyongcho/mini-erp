import { useState } from 'react'
import { Btn, Badge, Modal, TableWrap, Th, Td, FormGrid, FormGroup, Input, Select, SearchSelect, LineEditor, Summary } from '../components/UI.jsx'
import { api } from '../api.js'
import { useData } from '../context/DataContext.jsx'
import { TAX_STATUSES } from '../constants/index.js'
import { generateId, formatQuoteNo, today, calcItems, exportCSV, fmt, fmtW, normalizeItems } from '../utils/index.js'

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

export default function TaxPage({ renderLayout, user }) {
  const { data, refresh, showToast } = useData()
  const { taxes, customers, orders } = data
  const taxFormat = user?.tax_format || 'TAX-{YYYY}-{seq}'
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [sendForm, setSendForm] = useState({ to:'', subject:'', message:'' })
  const [sending, setSending] = useState(false)

  const openForm = () => {
    setForm({ id:formatQuoteNo(taxFormat, taxes), date:today(), customer_id:customers[0]?.id||'', order_id:'', status:'pending', note:'' })
    setItems([{name:'',qty:'',price:''}])
    setModal({mode:'form'})
  }

  const onPickOrder = (oid) => {
    const o = orders.find(x => x.id === oid)
    setForm(p => ({ ...p, order_id: oid, ...(o ? { customer_id: o.customer_id } : {}) }))
    if (o && o.items?.length) setItems(o.items.map(it => ({ ...it })))
  }

  const openSend = (t) => {
    const c = customers.find(x=>x.id===t.customer_id)||{}
    setSendForm({ to: c.email||'', subject:`[${user?.company||''}] 세금계산서 ${t.id}`, message:'' })
    setModal({mode:'send', id:t.id})
  }
  const sendMail = async () => {
    if (!sendForm.to || !sendForm.to.includes('@')) return showToast('받는사람 이메일을 입력하세요','error')
    setSending(true)
    try { await api.sendTax(modal.id, sendForm); showToast('메일이 발송되었습니다'); setModal(null) }
    catch(e){ showToast(e.message,'error') }
    setSending(false)
  }

  const save = async () => {
    if (!form.customer_id) return showToast('거래처를 선택하세요','error')
    if (!form.date) return showToast('발행일을 입력하세요','error')
    setSaving(true)
    try {
      const its = normalizeItems(items)
      const { supply, vat } = calcItems(its)
      const payload = {...form, customer_id:+form.customer_id, order_id:form.order_id||null, items:its, supply, vat}
      await api.createTax(payload)
      showToast('세금계산서가 발행되었습니다')
      await refresh(); setModal(null)
    } catch(e){ showToast(e.message,'error') }
    setSaving(false)
  }

  const issue = async (id) => {
    try { await api.issueTax(id); showToast('발행완료 처리되었습니다'); await refresh() } catch(e){ showToast(e.message,'error') }
  }

  const del = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    try { await api.deleteTax(id); showToast('삭제되었습니다'); await refresh() } catch(e){ showToast(e.message,'error') }
  }

  const viewT = (id) => setModal({mode:'view', id})
  const t_view = modal?.mode==='view' ? taxes.find(x=>x.id===modal.id) : null
  const c_view = t_view ? customers.find(x=>x.id===t_view.customer_id)||{} : {}

  const filtered = taxes.filter(t => {
    const c = customers.find(x=>x.id===t.customer_id)||{}
    return (c.name?.includes(search)||t.id.includes(search)) && (filter==='all'||t.status===filter)
  })
  const custOpts = customers.map(c=>({value:String(c.id),label:c.name}))
  const orderOpts = [{value:'',label:'없음'},...orders.map(o=>({value:o.id,label:o.id}))]

  const doExportCSV = () => {
    exportCSV(`taxes_${today()}.csv`, [
      {key:'id', label:'번호'},
      {key:'date', label:'발행일'},
      {key:'customerName', label:'거래처'},
      {key:'statusLabel', label:'상태'},
      {key:'supply', label:'공급가액'},
      {key:'vat', label:'부가세'},
      {key:'total', label:'합계'},
    ], filtered.map(t => {
      const c = customers.find(x=>x.id===t.customer_id)||{}
      const statusLabel = TAX_STATUSES.find(s=>s.value===t.status)?.label || t.status
      return {...t, customerName:c.name, statusLabel, total:(t.supply||0)+(t.vat||0)}
    }))
  }

  return renderLayout(
    <div style={{display:'flex',gap:8}}>
      <Btn onClick={doExportCSV}>CSV 내보내기</Btn>
      <Btn variant="primary" onClick={openForm}>+ 세금계산서 발행</Btn>
    </div>,
    <>
      <TableWrap title="세금계산서 목록" count={taxes.length} searchVal={search} onSearch={setSearch}
        filterEl={<select value={filter} onChange={e=>setFilter(e.target.value)} style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'6px 10px',color:'var(--text)',fontSize:12,outline:'none'}}>
          <option value="all">전체</option>
          {TAX_STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>}>
        <thead><tr><Th>계산서번호</Th><Th>거래처</Th><Th>발행일</Th><Th>연결발주</Th><Th right>공급가액</Th><Th right>부가세</Th><Th right>합계</Th><Th>상태</Th><Th>액션</Th></tr></thead>
        <tbody>
          {filtered.map(t => {
            const c = customers.find(x=>x.id===t.customer_id)||{}
            return <tr key={t.id}>
              <Td mono accent><span style={{cursor:'pointer'}} onClick={()=>viewT(t.id)}>{t.id}</span></Td>
              <Td>{c.name}</Td><Td>{t.date}</Td>
              <Td><span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--muted)'}}>{t.order_id||'-'}</span></Td>
              <Td right>{fmt(t.supply)}</Td><Td right>{fmt(t.vat)}</Td><Td right accent>{fmtW((t.supply||0)+(t.vat||0))}</Td>
              <Td><Badge status={t.status}/></Td>
              <Td><div style={{display:'flex',gap:4}}>
                <Btn size="sm" onClick={()=>viewT(t.id)}>보기</Btn>
                {t.status==='pending'&&<Btn size="sm" variant="success" onClick={()=>issue(t.id)}>발행처리</Btn>}
                <Btn size="sm" variant="primary" onClick={()=>openSend(t)}>발송</Btn>
                <Btn size="sm" variant="danger" onClick={()=>del(t.id)}>삭제</Btn>
              </div></Td>
            </tr>
          })}
          {filtered.length===0&&<tr><td colSpan={9} style={{textAlign:'center',padding:30,color:'var(--muted)'}}>세금계산서가 없습니다</td></tr>}
        </tbody>
      </TableWrap>

      {/* Issue form */}
      <Modal open={modal?.mode==='form'} onClose={()=>setModal(null)} title="세금계산서 발행" wide>
        <FormGrid>
          <FormGroup label="계산서번호"><Input value={form.id} readOnly mono /></FormGroup>
          <FormGroup label="거래처"><SearchSelect value={String(form.customer_id||'')} onChange={v=>setForm(f=>({...f,customer_id:v}))} options={custOpts} placeholder="거래처명 검색" /></FormGroup>
          <FormGroup label="발행일"><Input type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))} /></FormGroup>
          <FormGroup label="연결 발주서">
            <SearchSelect value={form.order_id||''} onChange={onPickOrder} options={orderOpts} placeholder="발주번호 검색" />
            <div style={{fontSize:11,color:'var(--muted)',marginTop:6}}>선택 시 품목명세가 자동으로 채워집니다</div>
          </FormGroup>
          <FormGroup label="상태"><Select value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={TAX_STATUSES} /></FormGroup>
          <FormGroup label="비고"><Input value={form.note} onChange={v=>setForm(f=>({...f,note:v}))} /></FormGroup>
        </FormGrid>
        <LineEditor items={items} onChange={setItems} />
        <Summary items={items} />
        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
          <Btn onClick={()=>setModal(null)}>취소</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving?'저장 중...':'저장'}</Btn>
        </div>
      </Modal>

      {/* View modal */}
      <Modal open={modal?.mode==='view'} onClose={()=>setModal(null)} title="세금계산서 상세" wide>
        {t_view && (
          <div>
            <div id="print-area" style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:24}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
                <div><h1 style={{fontSize:22,fontWeight:700}}>세금계산서</h1><div style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--accent)'}}>{t_view.id}</div></div>
                <Badge status={t_view.status}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20,padding:16,background:'var(--surface)',borderRadius:6,border:'1px solid var(--border)'}}>
                <div>
                  <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:8}}>공급자</div>
                  {[['상호',user?.company||'-'],['사업자번호',user?.biz_no||'-'],['발행일',t_view.date]].map(([k,v])=><div key={k} style={{display:'flex',gap:8,fontSize:12,marginBottom:4}}><span style={{color:'var(--muted)',minWidth:80}}>{k}</span><span>{v}</span></div>)}
                </div>
                <div>
                  <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:8}}>공급받는자</div>
                  {[['상호',c_view.name],['대표자',c_view.ceo],['사업자번호',c_view.biz_no]].map(([k,v])=><div key={k} style={{display:'flex',gap:8,fontSize:12,marginBottom:4}}><span style={{color:'var(--muted)',minWidth:80}}>{k}</span><span>{v}</span></div>)}
                </div>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['#','품목명','단위','수량','단가','공급가액'].map((h,i)=><th key={i} style={{padding:'8px 10px',fontSize:10,color:'var(--muted)',textAlign:i>=3?'right':'left',borderBottom:'1px solid var(--border)',background:'var(--surface)'}}>{h}</th>)}</tr></thead>
                <tbody>{(t_view.items||[]).map((it,i)=><tr key={i}><td style={{padding:10,fontFamily:'var(--mono)',color:'var(--muted)',fontSize:12}}>{String(i+1).padStart(2,'0')}</td><td style={{padding:10,fontSize:12}}>{it.name}</td><td style={{padding:10,fontSize:12}}>{it.unit}</td><td style={{padding:10,fontFamily:'var(--mono)',textAlign:'right',fontSize:12}}>{it.qty}</td><td style={{padding:10,fontFamily:'var(--mono)',textAlign:'right',fontSize:12}}>{fmt(it.price)}</td><td style={{padding:10,fontFamily:'var(--mono)',textAlign:'right',fontSize:12,color:'var(--accent)'}}>{fmt((it.qty||0)*(it.price||0))}</td></tr>)}</tbody>
              </table>
              <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}>
                <div style={{minWidth:280,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:16}}>
                  {[['공급가액',fmtW(t_view.supply||0)],['세액 (10%)',fmtW(t_view.vat||0)]].map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:12}}><span style={{color:'var(--label)'}}>{k}</span><span style={{fontFamily:'var(--mono)'}}>{v}</span></div>)}
                  <div style={{borderTop:'1px solid var(--border)',marginTop:8,paddingTop:8,display:'flex',justifyContent:'space-between',fontWeight:700,color:'var(--accent)',fontFamily:'var(--mono)',fontSize:15}}><span style={{fontSize:12,color:'var(--label)',fontFamily:'var(--sans)',fontWeight:400}}>합계금액</span>{fmtW((t_view.supply||0)+(t_view.vat||0))}</div>
                </div>
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:20}}>
              <Btn onClick={()=>setModal(null)}>닫기</Btn>
              <Btn onClick={printDoc}>🖨️ 인쇄/PDF</Btn>
              <Btn variant="success" onClick={()=>openSend(t_view)}>메일 발송</Btn>
              {t_view.status==='pending'&&<Btn variant="success" onClick={()=>{setModal(null);issue(t_view.id)}}>발행완료 처리</Btn>}
            </div>
          </div>
        )}
      </Modal>

      {/* 메일 발송 모달 */}
      <Modal open={modal?.mode==='send'} onClose={()=>setModal(null)} title="세금계산서 메일 발송">
        {!user?.smtp_configured && (
          <div style={{background:'rgba(245,158,11,.1)',border:'1px solid rgba(245,158,11,.3)',borderRadius:8,padding:'12px 14px',marginBottom:16,fontSize:12,color:'var(--warn)'}}>
            ⚠️ 메일(SMTP) 설정이 안 되어 있습니다. <b>내 정보 → 메일(SMTP) 설정</b>을 먼저 완료하세요.
          </div>
        )}
        <FormGrid cols={1}>
          <FormGroup label="받는사람 이메일"><Input type="email" value={sendForm.to} onChange={v=>setSendForm(f=>({...f,to:v}))} placeholder="customer@example.com" /></FormGroup>
          <FormGroup label="제목"><Input value={sendForm.subject} onChange={v=>setSendForm(f=>({...f,subject:v}))} /></FormGroup>
          <FormGroup label="메시지 (선택)"><Input value={sendForm.message} onChange={v=>setSendForm(f=>({...f,message:v}))} placeholder="안녕하세요, 세금계산서를 보내드립니다." /></FormGroup>
        </FormGrid>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
          <Btn onClick={()=>setModal(null)}>취소</Btn>
          <Btn variant="primary" onClick={sendMail} disabled={sending||!user?.smtp_configured}>{sending?'발송 중...':'메일 발송'}</Btn>
        </div>
      </Modal>
    </>
  )
}
