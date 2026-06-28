import { useState } from 'react'
import { Btn, Badge, Modal, TableWrap, Th, Td, FormGrid, FormGroup, Input, Select, SearchSelect, LineEditor, Summary } from '../components/UI.jsx'
import { api } from '../api.js'
import { useData } from '../context/DataContext.jsx'
import { CONTRACT_STATUSES } from '../constants/index.js'
import { generateId, formatQuoteNo, today, dateAdd, calcItems, exportCSV, fmt, fmtW, normalizeItems } from '../utils/index.js'

const STATUSES = [
  { value: 'reviewing',     label: '검토중',   color: 'rgba(100,116,139,.2)',   text: 'var(--muted)' },
  { value: 'waiting_sign',  label: '서명대기', color: 'rgba(79,143,255,.15)',   text: 'var(--accent)' },
  { value: 'active',        label: '계약중',   color: 'rgba(34,197,94,.15)',    text: 'var(--success)' },
  { value: 'renewing',      label: '갱신예정', color: 'rgba(0,212,168,.15)',    text: 'var(--accent2)' },
  { value: 'expired',       label: '만료',     color: 'rgba(245,158,11,.15)',   text: 'var(--warn)' },
  { value: 'terminated',    label: '해지',     color: 'rgba(239,68,68,.15)',    text: 'var(--danger)' },
]

function ContractBadge({ status }) {
  const s = STATUSES.find(x => x.value === status) || STATUSES[0]
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:s.color, color:s.text }}>{s.label}</span>
}

function DdayBadge({ days }) {
  if (days === null || days === undefined) return null
  if (days < 0) return <span style={{ fontSize:11, color:'var(--danger)', fontFamily:'var(--mono)' }}>D+{Math.abs(days)}</span>
  if (days <= 30) return <span style={{ fontSize:11, color:'var(--warn)', fontFamily:'var(--mono)' }}>D-{days}</span>
  return <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'var(--mono)' }}>D-{days}</span>
}

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

const DEFAULT_PAYMENT = '계약금 30%, 중도금 40%, 잔금 30%'
const DEFAULT_DELIVERY = '계약 후 30일 이내 납품'
const DEFAULT_WARRANTY = '납품일로부터 1년간 하자보증'

export default function ContractPage({ onNav, renderLayout, user }) {
  const { data, refresh, showToast } = useData()
  const { contracts, customers, quotations, products = [] } = data
  const contractFormat = user?.contract_format || 'CT-{YYYY}-{seq}'

  const saveProduct = async (it) => {
    if (!it.name?.trim()) return showToast('품목명이 비어있습니다','error')
    if (products.some(p => p.name === it.name)) return showToast('이미 등록된 품목입니다','error')
    const code = `PRD-${String(products.length+1).padStart(3,'0')}`
    try { await api.createProduct({ code, name: it.name, unit:'개', price: Number(it.price)||0, tax:true }); await refresh(); showToast(`'${it.name}' 품목관리에 등록되었습니다`) }
    catch(e){ showToast(e.message,'error') }
  }
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('info')
  const [sendForm, setSendForm] = useState({ to:'', subject:'', message:'' })
  const [sending, setSending] = useState(false)

  // 연결 견적서 선택 시 품목/금액/거래처 자동 반영
  const onPickQuotation = (qid) => {
    const q = quotations.find(x => x.id === qid)
    setForm(p => ({ ...p, quotation_id: qid, ...(q ? { customer_id: q.customer_id, amount: calcItems(q.items||[]).total } : {}) }))
    if (q && q.items?.length) setItems(q.items.map(it => ({ ...it })))
  }

  const openForm = (id, fromQuotationId) => {
    const c = id ? contracts.find(x => x.id === id) : null
    const q = fromQuotationId ? quotations.find(x => x.id === fromQuotationId) : null

    if (c) {
      setForm({ ...c })
      setItems(c.items || [])
    } else {
      const base = q ? {
        customer_id: q.customer_id,
        quotation_id: q.id,
        title: `${customers.find(x=>x.id===q.customer_id)?.name||''} 용역계약`,
        items: q.items || [],
        amount: calcItems(q.items||[]).total,
      } : {}
      setForm({
        id: formatQuoteNo(contractFormat, contracts),
        date: today(),
        start_date: today(),
        end_date: dateAdd(today(), 365),
        customer_id: base.customer_id || customers[0]?.id || '',
        quotation_id: base.quotation_id || '',
        status: 'reviewing',
        title: base.title || '',
        amount: base.amount || 0,
        payment_terms: DEFAULT_PAYMENT,
        delivery_terms: DEFAULT_DELIVERY,
        warranty: DEFAULT_WARRANTY,
        special_terms: '',
        note: '',
      })
      setItems(base.items || [{ name:'', qty:1, price:0, unit:'개' }])
    }
    setTab('info')
    setModal({ mode: 'form', id })
  }

  const save = async () => {
    if (!form.customer_id) return showToast('거래처를 선택하세요', 'error')
    if (!form.title) return showToast('계약명을 입력하세요', 'error')
    if (form.start_date && form.end_date && form.end_date < form.start_date) return showToast('계약 종료일은 시작일 이후여야 합니다', 'error')
    setSaving(true)
    try {
      const its = normalizeItems(items)
      const { total } = calcItems(its)
      const payload = {
        ...form,
        customer_id: +form.customer_id,
        quotation_id: form.quotation_id || null,
        amount: total || +form.amount || 0,
        items: its,
      }
      if (modal.id) await api.updateContract(modal.id, payload)
      else await api.createContract(payload)
      showToast(modal.id ? '계약서가 수정되었습니다' : '계약서가 저장되었습니다')
      await refresh(); setModal(null)
    } catch(e) { showToast(e.message, 'error') }
    setSaving(false)
  }

  const changeStatus = async (id, status) => {
    try {
      await api.updateContractStatus(id, status)
      const label = STATUSES.find(s=>s.value===status)?.label || status
      showToast(`계약 상태가 "${label}"으로 변경되었습니다`)
      await refresh()
    } catch(e) { showToast(e.message, 'error') }
  }

  const del = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    try { await api.deleteContract(id); showToast('삭제되었습니다'); await refresh() } catch(e) { showToast(e.message, 'error') }
  }

  const convertToOrder = async (c) => {
    const oid = generateId('PO', data.orders)
    try {
      await api.createOrder({ id:oid, date:today(), deliver:dateAdd(today(),14), customer_id:c.customer_id, quotation_id:c.quotation_id||null, contract_id:c.id, status:'ordered', note:`계약 ${c.id} 기반`, items:c.items })
      showToast(`발주서 ${oid} 생성 완료`)
      await refresh(); onNav('order')
    } catch(e) { showToast(e.message, 'error') }
  }

  const openSend = (c) => {
    const cu = customers.find(x=>x.id===c.customer_id)||{}
    setSendForm({ to: cu.email||'', subject:`[${user?.company||''}] 계약서 ${c.id}`, message:'' })
    setModal({mode:'send', id:c.id})
  }
  const sendMail = async () => {
    if (!sendForm.to || !sendForm.to.includes('@')) return showToast('받는사람 이메일을 입력하세요','error')
    setSending(true)
    try { await api.sendContract(modal.id, sendForm); showToast('메일이 발송되었습니다'); setModal(null) }
    catch(e){ showToast(e.message,'error') }
    setSending(false)
  }

  const viewC = (id) => { setModal({ mode:'view', id }) }
  const c_view = modal?.mode==='view' ? contracts.find(x=>x.id===modal.id) : null
  const cv_customer = c_view ? customers.find(x=>x.id===c_view.customer_id)||{} : {}

  const filtered = contracts.filter(c => {
    const cu = customers.find(x=>x.id===c.customer_id)||{}
    const matchSearch = cu.name?.includes(search)||c.id.includes(search)||c.title?.includes(search)
    const matchFilter = filter==='all' || c.status===filter
    const matchFrom = !dateFrom || c.end_date >= dateFrom
    const matchTo = !dateTo || c.end_date <= dateTo
    return matchSearch && matchFilter && matchFrom && matchTo
  })

  const expiringSoon = contracts.filter(c => c.status==='active' && c.days_left !== null && c.days_left >= 0 && c.days_left <= 30)

  const custOpts = customers.map(c=>({value:String(c.id), label:c.name}))
  const quoteOpts = [{value:'', label:'없음'}, ...quotations.map(q=>({ value:q.id, label:`${q.id} — ${customers.find(x=>x.id===q.customer_id)?.name||''}` }))]

  const f = (k) => v => setForm(p=>({...p,[k]:v}))

  const Textarea = ({ value, onChange, placeholder, rows=4 }) => (
    <textarea value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'9px 12px', color:'var(--text)', fontFamily:'var(--sans)', fontSize:13, outline:'none', width:'100%', resize:'vertical' }} />
  )

  const doExportCSV = () => {
    exportCSV(`contracts_${today()}.csv`, [
      {key:'id', label:'번호'},
      {key:'title', label:'제목'},
      {key:'customerName', label:'거래처'},
      {key:'statusLabel', label:'상태'},
      {key:'start_date', label:'시작일'},
      {key:'end_date', label:'종료일'},
      {key:'amount', label:'금액'},
      {key:'dday', label:'D-day'},
    ], filtered.map(c => {
      const cu = customers.find(x=>x.id===c.customer_id)||{}
      const statusLabel = CONTRACT_STATUSES.find(s=>s.value===c.status)?.label || c.status
      const dday = c.days_left != null ? (c.days_left < 0 ? `D+${Math.abs(c.days_left)}` : `D-${c.days_left}`) : ''
      return {...c, customerName:cu.name, statusLabel, dday}
    }))
  }

  return renderLayout(
    <div style={{display:'flex',gap:8}}>
      <Btn onClick={doExportCSV}>CSV 내보내기</Btn>
      <Btn variant="primary" onClick={()=>openForm()}>+ 계약서 작성</Btn>
    </div>,
    <>
      {expiringSoon.length > 0 && (
        <div style={{ background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.3)', borderRadius:8, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:16 }}>⚠️</span>
          <span style={{ fontSize:12, color:'var(--warn)' }}>
            만료 30일 이내 계약 <strong>{expiringSoon.length}건</strong>: {expiringSoon.map(c=>c.id).join(', ')}
          </span>
        </div>
      )}

      <TableWrap title="계약서 목록" count={contracts.length} searchVal={search} onSearch={setSearch}
        filterEl={
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{color:'var(--muted)',fontSize:12}}>종료일</span>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
              style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'6px 10px',color:'var(--text)',fontSize:12,outline:'none'}} />
            <span style={{color:'var(--muted)',fontSize:12}}>~</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
              style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'6px 10px',color:'var(--text)',fontSize:12,outline:'none'}} />
            <select value={filter} onChange={e=>setFilter(e.target.value)}
              style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 10px', color:'var(--text)', fontSize:12, outline:'none' }}>
              <option value="all">전체</option>
              {STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        }>
        <thead>
          <tr>
            <Th>계약번호</Th><Th>계약명</Th><Th>거래처</Th><Th>계약기간</Th>
            <Th right>계약금액</Th><Th>D-day</Th><Th>상태</Th><Th>액션</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(c => {
            const cu = customers.find(x=>x.id===c.customer_id)||{}
            return (
              <tr key={c.id}>
                <Td mono accent>
                  <span style={{cursor:'pointer'}} onClick={()=>viewC(c.id)}>{c.id}</span>
                </Td>
                <Td><span style={{fontWeight:500}}>{c.title}</span></Td>
                <Td>{cu.name}</Td>
                <Td><span style={{fontSize:11, fontFamily:'var(--mono)', color:'var(--muted)'}}>{c.start_date} ~ {c.end_date}</span></Td>
                <Td right accent>{fmtW(c.amount)}</Td>
                <Td><DdayBadge days={c.days_left} /></Td>
                <Td><ContractBadge status={c.status} /></Td>
                <Td>
                  <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                    <Btn size="sm" onClick={()=>viewC(c.id)}>보기</Btn>
                    <Btn size="sm" onClick={()=>openForm(c.id)}>수정</Btn>
                    <Btn size="sm" variant="primary" onClick={()=>openSend(c)}>발송</Btn>
                    {c.status==='active' && <Btn size="sm" variant="warn" onClick={()=>convertToOrder(c)}>발주전환</Btn>}
                    <Btn size="sm" variant="danger" onClick={()=>del(c.id)}>삭제</Btn>
                  </div>
                </Td>
              </tr>
            )
          })}
          {filtered.length===0 && (
            <tr><td colSpan={8} style={{textAlign:'center', padding:30, color:'var(--muted)'}}>계약서가 없습니다</td></tr>
          )}
        </tbody>
      </TableWrap>

      {/* 작성/수정 모달 */}
      <Modal open={modal?.mode==='form'} onClose={()=>setModal(null)} title={modal?.id ? '계약서 수정' : '계약서 작성'} wide>
        <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border)', marginBottom:20 }}>
          {[['info','기본정보'],['terms','계약조건'],['items','품목명세']].map(([k,l])=>(
            <div key={k} onClick={()=>setTab(k)}
              style={{ padding:'9px 18px', cursor:'pointer', fontSize:13, color:tab===k?'var(--accent)':'var(--muted)', borderBottom:`2px solid ${tab===k?'var(--accent)':'transparent'}`, transition:'all .15s' }}>
              {l}
            </div>
          ))}
        </div>

        {tab==='info' && (
          <FormGrid>
            <FormGroup label="계약번호"><Input value={form.id} readOnly mono /></FormGroup>
            <FormGroup label="거래처">
              <SearchSelect value={String(form.customer_id||'')} onChange={f('customer_id')} options={custOpts} placeholder="거래처명 검색" />
            </FormGroup>
            <FormGroup label="계약명" full><Input value={form.title} onChange={f('title')} placeholder="예: IT 시스템 구축 용역계약" /></FormGroup>
            <FormGroup label="계약일"><Input type="date" value={form.date} onChange={f('date')} /></FormGroup>
            <FormGroup label="상태">
              <Select value={form.status} onChange={f('status')} options={STATUSES.map(s=>({value:s.value,label:s.label}))} />
            </FormGroup>
            <FormGroup label="계약 시작일"><Input type="date" value={form.start_date} onChange={f('start_date')} /></FormGroup>
            <FormGroup label="계약 종료일"><Input type="date" value={form.end_date} onChange={f('end_date')} /></FormGroup>
            <FormGroup label="연결 견적서">
              <SearchSelect value={form.quotation_id||''} onChange={onPickQuotation} options={quoteOpts} placeholder="견적번호/거래처 검색" />
              <div style={{fontSize:11,color:'var(--muted)',marginTop:6}}>선택 시 품목명세가 자동으로 채워집니다</div>
            </FormGroup>
            <FormGroup label="비고"><Input value={form.note} onChange={f('note')} /></FormGroup>
          </FormGrid>
        )}

        {tab==='terms' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <FormGroup label="결제 조건">
              <Textarea value={form.payment_terms} onChange={f('payment_terms')} placeholder="예: 계약금 30%, 중도금 40%, 잔금 30%" rows={3} />
            </FormGroup>
            <FormGroup label="납품 조건">
              <Textarea value={form.delivery_terms} onChange={f('delivery_terms')} placeholder="예: 계약 후 30일 이내 납품" rows={3} />
            </FormGroup>
            <FormGroup label="하자보증">
              <Textarea value={form.warranty} onChange={f('warranty')} placeholder="예: 납품일로부터 1년간 하자보증" rows={3} />
            </FormGroup>
            <FormGroup label="특약사항">
              <Textarea value={form.special_terms} onChange={f('special_terms')} placeholder="기타 특약사항을 입력하세요" rows={4} />
            </FormGroup>
          </div>
        )}

        {tab==='items' && (
          <>
            <LineEditor items={items} onChange={setItems} products={products} onSaveProduct={saveProduct} />
            <Summary items={items} />
          </>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:24, paddingTop:20, borderTop:'1px solid var(--border)' }}>
          <Btn onClick={()=>setModal(null)}>취소</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving?'저장 중...':'저장'}</Btn>
        </div>
      </Modal>

      {/* 상세 보기 모달 */}
      <Modal open={modal?.mode==='view'} onClose={()=>setModal(null)} title="계약서 상세" wide>
        {c_view && (() => {
          const { supply, vat, total } = calcItems(c_view.items||[])
          return (
            <div>
              <div id="print-area" style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:24 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, paddingBottom:20, borderBottom:'1px solid var(--border)' }}>
                  <div>
                    <h1 style={{ fontSize:24, fontWeight:700, marginBottom:4 }}>계약서</h1>
                    <div style={{ fontFamily:'var(--mono)', fontSize:13, color:'var(--accent)' }}>{c_view.id}</div>
                    <div style={{ fontSize:13, color:'var(--muted)', marginTop:4 }}>{c_view.title}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <ContractBadge status={c_view.status} />
                    <div style={{ marginTop:8 }}><DdayBadge days={c_view.days_left} /></div>
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20, padding:16, background:'var(--surface)', borderRadius:6, border:'1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:8 }}>공급자 (갑)</div>
                    {[['상호',user?.company||'-'],['계약일',c_view.date],['계약기간',`${c_view.start_date} ~ ${c_view.end_date}`]].map(([k,v])=>(
                      <div key={k} style={{ display:'flex', gap:8, fontSize:12, marginBottom:4 }}>
                        <span style={{ color:'var(--muted)', minWidth:70 }}>{k}</span><span>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:8 }}>공급받는자 (을)</div>
                    {[['상호',cv_customer.name],['대표자',cv_customer.ceo],['사업자번호',cv_customer.biz_no],['주소',cv_customer.addr]].map(([k,v])=>(
                      <div key={k} style={{ display:'flex', gap:8, fontSize:12, marginBottom:4 }}>
                        <span style={{ color:'var(--muted)', minWidth:70 }}>{k}</span><span>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {(c_view.items||[]).length > 0 && (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.7px', marginBottom:8 }}>계약 품목</div>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr>{['#','품목명','단위','수량','단가','금액'].map((h,i)=>(
                          <th key={i} style={{ padding:'8px 10px', fontSize:10, color:'var(--muted)', textAlign:i>=3?'right':'left', borderBottom:'1px solid var(--border)', background:'var(--surface)' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {c_view.items.map((it,i)=>(
                          <tr key={i}>
                            <td style={{ padding:'10px', fontFamily:'var(--mono)', color:'var(--muted)', fontSize:12 }}>{String(i+1).padStart(2,'0')}</td>
                            <td style={{ padding:'10px', fontSize:12 }}>{it.name}</td>
                            <td style={{ padding:'10px', fontSize:12 }}>{it.unit}</td>
                            <td style={{ padding:'10px', fontFamily:'var(--mono)', textAlign:'right', fontSize:12 }}>{it.qty}</td>
                            <td style={{ padding:'10px', fontFamily:'var(--mono)', textAlign:'right', fontSize:12 }}>{fmt(it.price)}</td>
                            <td style={{ padding:'10px', fontFamily:'var(--mono)', textAlign:'right', fontSize:12, color:'var(--accent)' }}>{fmt((it.qty||0)*(it.price||0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
                      <div style={{ minWidth:260, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:14 }}>
                        {[['공급가액',fmtW(supply)],['부가세',fmtW(vat)]].map(([k,v])=>(
                          <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:12 }}>
                            <span style={{ color:'var(--label)' }}>{k}</span>
                            <span style={{ fontFamily:'var(--mono)' }}>{v}</span>
                          </div>
                        ))}
                        <div style={{ borderTop:'1px solid var(--border)', marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between', fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)', fontSize:15 }}>
                          <span style={{ fontSize:12, color:'var(--label)', fontFamily:'var(--sans)', fontWeight:400 }}>계약금액</span>
                          {fmtW(total)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {[['결제 조건',c_view.payment_terms],['납품 조건',c_view.delivery_terms],['하자보증',c_view.warranty],['특약사항',c_view.special_terms]].filter(([,v])=>v).map(([k,v])=>(
                  <div key={k} style={{ marginBottom:14, padding:14, background:'var(--surface)', borderRadius:6, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.7px', marginBottom:6 }}>{k}</div>
                    <div style={{ fontSize:12, lineHeight:1.7, whiteSpace:'pre-wrap' }}>{v}</div>
                  </div>
                ))}

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginTop:24, padding:16, background:'var(--surface)', borderRadius:6, border:'1px solid var(--border)' }}>
                  {['공급자 (갑)','공급받는자 (을)'].map(label=>(
                    <div key={label} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:11, color:'var(--muted)', marginBottom:40 }}>{label}</div>
                      <div style={{ borderTop:'1px solid var(--border)', paddingTop:8, fontSize:11, color:'var(--muted)' }}>서명 / 날인</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop:16, padding:14, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 }}>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:10 }}>상태 변경</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {STATUSES.filter(s=>s.value!==c_view.status).map(s=>(
                    <button key={s.value} onClick={()=>changeStatus(c_view.id, s.value)}
                      style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${s.color}`, background:'transparent', color:s.text, fontSize:11, cursor:'pointer', fontFamily:'var(--sans)' }}>
                      → {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:16 }}>
                <Btn onClick={()=>setModal(null)}>닫기</Btn>
                <Btn onClick={printDoc}>🖨️ 인쇄/PDF</Btn>
                <Btn variant="success" onClick={()=>openSend(c_view)}>메일 발송</Btn>
                <Btn variant="primary" onClick={()=>{ setModal(null); openForm(c_view.id) }}>수정</Btn>
                {c_view.status==='active' && <Btn variant="warn" onClick={()=>{ setModal(null); convertToOrder(c_view) }}>발주서 전환</Btn>}
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* 메일 발송 모달 */}
      <Modal open={modal?.mode==='send'} onClose={()=>setModal(null)} title="계약서 메일 발송">
        {!user?.smtp_configured && (
          <div style={{background:'rgba(245,158,11,.1)',border:'1px solid rgba(245,158,11,.3)',borderRadius:8,padding:'12px 14px',marginBottom:16,fontSize:12,color:'var(--warn)'}}>
            ⚠️ 메일(SMTP) 설정이 안 되어 있습니다. <b>내 정보 → 메일(SMTP) 설정</b>을 먼저 완료하세요.
          </div>
        )}
        <FormGrid cols={1}>
          <FormGroup label="받는사람 이메일"><Input type="email" value={sendForm.to} onChange={v=>setSendForm(f=>({...f,to:v}))} placeholder="customer@example.com" /></FormGroup>
          <FormGroup label="제목"><Input value={sendForm.subject} onChange={v=>setSendForm(f=>({...f,subject:v}))} /></FormGroup>
          <FormGroup label="메시지 (선택)"><Input value={sendForm.message} onChange={v=>setSendForm(f=>({...f,message:v}))} placeholder="안녕하세요, 계약서를 보내드립니다." /></FormGroup>
        </FormGrid>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
          <Btn onClick={()=>setModal(null)}>취소</Btn>
          <Btn variant="primary" onClick={sendMail} disabled={sending||!user?.smtp_configured}>{sending?'발송 중...':'메일 발송'}</Btn>
        </div>
      </Modal>
    </>
  )
}
