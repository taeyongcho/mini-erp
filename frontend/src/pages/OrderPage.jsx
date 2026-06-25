import { useState } from 'react'
import { Btn, Badge, Modal, TableWrap, Th, Td, FormGrid, FormGroup, Input, Select, LineEditor, Summary, toast, fmt, fmtW, calcItems, today, dateAdd } from '../components/UI.jsx'
import { api } from '../api.js'

function nextId(orders) {
  const yr = new Date().getFullYear()
  const max = orders.filter(o=>o.id.startsWith('PO-'+yr)).reduce((m,o)=>{ const n=+o.id.split('-')[2]; return n>m?n:m },0)
  return `PO-${yr}-${String(max+1).padStart(3,'0')}`
}

export default function OrderPage({ data, refresh, renderLayout }) {
  const { orders, customers } = data
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)

  const openForm = (id) => {
    const o = id ? orders.find(x=>x.id===id) : null
    setForm(o ? {...o} : { id:nextId(orders), date:today(), deliver:dateAdd(today(),14), customer_id:customers[0]?.id||'', status:'ordered', note:'' })
    setItems(o ? (o.items||[]) : [{name:'',qty:1,price:0,unit:'개'}])
    setModal({mode:'form', id})
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = {...form, items:items.filter(i=>i.name), customer_id:+form.customer_id}
      if (modal.id) await api.updateOrder(modal.id, payload)
      else await api.createOrder(payload)
      toast(modal.id ? '발주서가 수정되었습니다' : '발주서가 저장되었습니다')
      await refresh(); setModal(null)
    } catch(e){ toast(e.message,'error') }
    setSaving(false)
  }

  const del = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    try { await api.deleteOrder(id); toast('삭제되었습니다'); await refresh() } catch(e){ toast(e.message,'error') }
  }

  const issueFromOrder = (id) => {
    setModal({mode:'taxIssue', orderId:id})
  }

  const filtered = orders.filter(o => {
    const c = customers.find(x=>x.id===o.customer_id)||{}
    return (c.name?.includes(search)||o.id.includes(search)) && (filter==='all'||o.status===filter)
  })
  const custOpts = customers.map(c=>({value:String(c.id),label:c.name}))
  const statOpts = [{value:'ordered',label:'발주'},{value:'completed',label:'완료'}]

  return renderLayout(
    <Btn variant="primary" onClick={()=>openForm()}>+ 발주서 작성</Btn>,
    <>
      <TableWrap title="발주서 목록" count={orders.length} searchVal={search} onSearch={setSearch}
        filterEl={<select value={filter} onChange={e=>setFilter(e.target.value)} style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'6px 10px',color:'var(--text)',fontSize:12,outline:'none'}}>
          <option value="all">전체</option><option value="ordered">발주</option><option value="completed">완료</option>
        </select>}>
        <thead><tr><Th>발주번호</Th><Th>거래처</Th><Th>발주일</Th><Th>납기일</Th><Th right>공급가액</Th><Th right>VAT</Th><Th right>합계</Th><Th>상태</Th><Th>액션</Th></tr></thead>
        <tbody>
          {filtered.map(o => {
            const c = customers.find(x=>x.id===o.customer_id)||{}
            const {supply,vat,total} = calcItems(o.items||[])
            return <tr key={o.id}>
              <Td mono accent>{o.id}</Td><Td>{c.name}</Td><Td>{o.date}</Td><Td>{o.deliver}</Td>
              <Td right>{fmt(supply)}</Td><Td right>{fmt(vat)}</Td><Td right accent>{fmtW(total)}</Td>
              <Td><Badge status={o.status}/></Td>
              <Td><div style={{display:'flex',gap:4}}>
                <Btn size="sm" onClick={()=>openForm(o.id)}>수정</Btn>
                {o.status==='ordered'&&<Btn size="sm" variant="success" onClick={()=>issueFromOrder(o.id)}>계산서발행</Btn>}
                <Btn size="sm" variant="danger" onClick={()=>del(o.id)}>삭제</Btn>
              </div></Td>
            </tr>
          })}
          {filtered.length===0&&<tr><td colSpan={9} style={{textAlign:'center',padding:30,color:'var(--muted)'}}>발주서가 없습니다</td></tr>}
        </tbody>
      </TableWrap>

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
    </>
  )
}
