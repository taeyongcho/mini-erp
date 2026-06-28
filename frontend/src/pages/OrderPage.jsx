import { useState } from 'react'
import { Btn, Badge, Modal, TableWrap, Th, Td, FormGrid, FormGroup, Input, Select, LineEditor, Summary } from '../components/UI.jsx'
import { api } from '../api.js'
import { useData } from '../context/DataContext.jsx'
import { ORDER_STATUSES } from '../constants/index.js'
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

export default function OrderPage({ renderLayout }) {
  const { data, refresh, showToast } = useData()
  const { orders, customers } = data
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)

  const openForm = (id) => {
    const o = id ? orders.find(x=>x.id===id) : null
    setForm(o ? {...o} : { id:generateId('PO', orders), date:today(), deliver:dateAdd(today(),14), customer_id:customers[0]?.id||'', status:'ordered', note:'' })
    setItems(o ? (o.items||[]) : [{name:'',qty:1,price:0,unit:'개'}])
    setModal({mode:'form', id})
  }

  const save = async () => {
    if (!form.customer_id) return showToast('거래처를 선택하세요','error')
    if (!form.date || !form.deliver) return showToast('발주일/납기일을 입력하세요','error')
    setSaving(true)
    try {
      const payload = {...form, items:items.filter(i=>i.name), customer_id:+form.customer_id}
      if (modal.id) await api.updateOrder(modal.id, payload)
      else await api.createOrder(payload)
      showToast(modal.id ? '발주서가 수정되었습니다' : '발주서가 저장되었습니다')
      await refresh(); setModal(null)
    } catch(e){ showToast(e.message,'error') }
    setSaving(false)
  }

  const del = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    try { await api.deleteOrder(id); showToast('삭제되었습니다'); await refresh() } catch(e){ showToast(e.message,'error') }
  }

  const viewO = (id) => setModal({mode:'view', id})
  const o_view = modal?.mode==='view' ? orders.find(x=>x.id===modal.id) : null
  const oc_view = o_view ? customers.find(x=>x.id===o_view.customer_id)||{} : {}

  const filtered = orders.filter(o => {
    const c = customers.find(x=>x.id===o.customer_id)||{}
    return (c.name?.includes(search)||o.id.includes(search)) && (filter==='all'||o.status===filter)
  })
  const custOpts = customers.map(c=>({value:String(c.id),label:c.name}))
  const statOpts = ORDER_STATUSES

  const doExportCSV = () => {
    exportCSV(`orders_${today()}.csv`, [
      {key:'id', label:'번호'},
      {key:'date', label:'날짜'},
      {key:'deliver', label:'납기일'},
      {key:'customerName', label:'거래처'},
      {key:'statusLabel', label:'상태'},
      {key:'quotation_id', label:'견적번호'},
      {key:'contract_id', label:'계약번호'},
      {key:'supply', label:'공급가액'},
      {key:'total', label:'합계'},
    ], filtered.map(o => {
      const c = customers.find(x=>x.id===o.customer_id)||{}
      const {supply,total} = calcItems(o.items||[])
      const statusLabel = ORDER_STATUSES.find(s=>s.value===o.status)?.label || o.status
      return {...o, customerName:c.name, statusLabel, supply, total}
    }))
  }

  return renderLayout(
    <div style={{display:'flex',gap:8}}>
      <Btn onClick={doExportCSV}>CSV 내보내기</Btn>
      <Btn variant="primary" onClick={()=>openForm()}>+ 발주서 작성</Btn>
    </div>,
    <>
      <TableWrap title="발주서 목록" count={orders.length} searchVal={search} onSearch={setSearch}
        filterEl={<select value={filter} onChange={e=>setFilter(e.target.value)} style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'6px 10px',color:'var(--text)',fontSize:12,outline:'none'}}>
          <option value="all">전체</option>
          {ORDER_STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
        </select>}>
        <thead><tr><Th>발주번호</Th><Th>거래처</Th><Th>발주일</Th><Th>납기일</Th><Th right>공급가액</Th><Th right>VAT</Th><Th right>합계</Th><Th>상태</Th><Th>액션</Th></tr></thead>
        <tbody>
          {filtered.map(o => {
            const c = customers.find(x=>x.id===o.customer_id)||{}
            const {supply,vat,total} = calcItems(o.items||[])
            return <tr key={o.id}>
              <Td mono accent><span style={{cursor:'pointer'}} onClick={()=>viewO(o.id)}>{o.id}</span></Td>
              <Td>{c.name}</Td><Td>{o.date}</Td><Td>{o.deliver}</Td>
              <Td right>{fmt(supply)}</Td><Td right>{fmt(vat)}</Td><Td right accent>{fmtW(total)}</Td>
              <Td><Badge status={o.status}/></Td>
              <Td><div style={{display:'flex',gap:4}}>
                <Btn size="sm" onClick={()=>viewO(o.id)}>보기</Btn>
                <Btn size="sm" onClick={()=>openForm(o.id)}>수정</Btn>
                <Btn size="sm" variant="danger" onClick={()=>del(o.id)}>삭제</Btn>
              </div></Td>
            </tr>
          })}
          {filtered.length===0&&<tr><td colSpan={9} style={{textAlign:'center',padding:30,color:'var(--muted)'}}>발주서가 없습니다</td></tr>}
        </tbody>
      </TableWrap>

      {/* Form Modal */}
      <Modal open={modal?.mode==='form'} onClose={()=>setModal(null)} title={modal?.id?'발주서 수정':'발주서 작성'} wide>
        <FormGrid>
          <FormGroup label="발주번호"><Input value={form.id} readOnly mono /></FormGroup>
          <FormGroup label="거래처"><Select value={String(form.customer_id||'')} onChange={v=>setForm(f=>({...f,customer_id:v}))} options={custOpts} /></FormGroup>
          <FormGroup label="발주일"><Input type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))} /></FormGroup>
          <FormGroup label="납기일"><Input type="date" value={form.deliver} onChange={v=>setForm(f=>({...f,deliver:v}))} /></FormGroup>
          <FormGroup label="상태"><Select value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={statOpts} /></FormGroup>
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
      <Modal open={modal?.mode==='view'} onClose={()=>setModal(null)} title="발주서 상세" wide>
        {o_view && (() => {
          const {supply,vat,total} = calcItems(o_view.items||[])
          return <>
            <div id="print-area" style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:24}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
                <div><h1 style={{fontSize:22,fontWeight:700}}>발주서</h1><div style={{fontFamily:'var(--mono)',fontSize:13,color:'var(--accent)'}}>{o_view.id}</div></div>
                <Badge status={o_view.status}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20,padding:16,background:'var(--surface)',borderRadius:6,border:'1px solid var(--border)'}}>
                <div>
                  <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:8}}>발주자</div>
                  {[['상호','Axiosoft (주)'],['발주일',o_view.date],['납기일',o_view.deliver]].map(([k,v])=><div key={k} style={{display:'flex',gap:8,fontSize:12,marginBottom:4}}><span style={{color:'var(--muted)',minWidth:70}}>{k}</span><span>{v}</span></div>)}
                </div>
                <div>
                  <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:8}}>공급업체</div>
                  {[['상호',oc_view.name],['대표자',oc_view.ceo],['사업자번호',oc_view.biz_no],['주소',oc_view.addr]].map(([k,v])=><div key={k} style={{display:'flex',gap:8,fontSize:12,marginBottom:4}}><span style={{color:'var(--muted)',minWidth:70}}>{k}</span><span>{v}</span></div>)}
                </div>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['#','품목명','단위','수량','단가','금액'].map((h,i)=><th key={i} style={{padding:'8px 10px',fontSize:10,color:'var(--muted)',textAlign:i>=3?'right':'left',borderBottom:'1px solid var(--border)',background:'var(--surface)'}}>{h}</th>)}</tr></thead>
                <tbody>{(o_view.items||[]).map((it,i)=><tr key={i}><td style={{padding:'10px',fontFamily:'var(--mono)',color:'var(--muted)',fontSize:12}}>{String(i+1).padStart(2,'0')}</td><td style={{padding:'10px',fontSize:12}}>{it.name}</td><td style={{padding:'10px',fontSize:12}}>{it.unit}</td><td style={{padding:'10px',fontFamily:'var(--mono)',textAlign:'right',fontSize:12}}>{it.qty}</td><td style={{padding:'10px',fontFamily:'var(--mono)',textAlign:'right',fontSize:12}}>{fmt(it.price)}</td><td style={{padding:'10px',fontFamily:'var(--mono)',textAlign:'right',fontSize:12,color:'var(--accent)'}}>{fmt((it.qty||0)*(it.price||0))}</td></tr>)}</tbody>
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
              <Btn variant="primary" onClick={()=>openForm(o_view.id)}>수정</Btn>
            </div>
          </>
        })()}
      </Modal>
    </>
  )
}
