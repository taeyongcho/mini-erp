import { useState } from 'react'
import { useData } from '../context/DataContext.jsx'
import { api } from '../api.js'
import { StatCard, Btn, Modal, FormGrid, FormGroup, Input, SearchSelect, TableWrap, Th, Td, fmtW } from '../components/UI.jsx'
import { exportCSV, today, dateAdd, calcItems } from '../utils/index.js'

const STATUS_LABEL = { pending: '미지급', partial: '부분지급', settled: '완료' }
const STATUS_COLOR = { pending: 'var(--danger)', partial: 'var(--accent2)', settled: 'var(--success)' }

function StatusBadge({ status }) {
  return (
    <span style={{ display:'inline-flex', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:500,
      background: status === 'settled' ? 'rgba(34,197,94,.15)' : status === 'partial' ? 'rgba(0,212,168,.15)' : 'rgba(239,68,68,.15)',
      color: STATUS_COLOR[status] || 'var(--muted)' }}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

const inYear = (d, y) => d ? String(d).slice(0,4) === String(y) : false

export default function PayablePage({ renderLayout }) {
  const { data, refresh, showToast } = useData()
  const { payables = [], customers = [], taxes = [], orders = [] } = data

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [yearOpen, setYearOpen] = useState(false)
  const [view, setView] = useState('unsettled')
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(null)
  const [form, setForm] = useState({ customer_id: '', amount: '', due_date: dateAdd(today(), 30), order_id: '', note: '' })
  const [settleForm, setSettleForm] = useState({ settled_amount: '', settled_date: today(), note: '' })

  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i)
  const yearPays = payables.filter(p => inYear(p.created_at || p.due_date, year))

  const totalRemaining = yearPays.filter(p => p.status !== 'settled').reduce((s, p) => s + (p.remaining || 0), 0)
  const totalSettled = yearPays.reduce((s, p) => s + (p.settled_amount || 0), 0)

  let shown = yearPays
  if (view === 'unsettled') shown = yearPays.filter(p => p.status !== 'settled')
  else if (view === 'settled') shown = yearPays.filter(p => p.status === 'settled')
  if (search) shown = shown.filter(p => (p.customer_name || '').toLowerCase().includes(search.toLowerCase()))

  async function handleAdd() {
    if (!form.customer_id) return showToast('거래처를 선택하세요', 'error')
    if (!(Number(form.amount) > 0)) return showToast('금액은 0보다 커야 합니다', 'error')
    try {
      await api.createPayable({ ...form, customer_id: Number(form.customer_id), amount: Number(form.amount), order_id: form.order_id || null })
      await refresh(); setAddOpen(false)
      setForm({ customer_id: '', amount: '', due_date: dateAdd(today(), 30), order_id: '', note: '' })
      showToast('미지급금이 추가되었습니다')
    } catch (e) { showToast(e.message, 'error') }
  }

  async function handleSettle() {
    const billable = (settleOpen.remaining || 0) + (settleOpen.settled_amount || 0)
    if (Number(settleForm.settled_amount) > billable) return showToast('지급액이 청구금액을 초과할 수 없습니다', 'error')
    try {
      await api.settlePayable(settleOpen.id, { ...settleForm, settled_amount: Number(settleForm.settled_amount) })
      await refresh(); setSettleOpen(null)
      showToast('정산 처리되었습니다')
    } catch (e) { showToast(e.message, 'error') }
  }

  async function handleDelete(id) {
    if (!confirm('삭제하시겠습니까?')) return
    try { await api.deletePayable(id); await refresh(); showToast('삭제되었습니다') }
    catch (e) { showToast(e.message, 'error') }
  }

  function handleExport() {
    exportCSV(`미지급금_${year}.csv`, [
      { key: 'customer_name', label: '거래처' },
      { key: 'order_id', label: '발주서번호' },
      { key: 'amount', label: '지급금액' },
      { key: 'due_date', label: '지급예정일' },
      { key: 'remaining', label: '잔액' },
      { key: 'status', label: '상태' },
    ], shown.map(p => ({ ...p, status: STATUS_LABEL[p.status] || p.status })))
  }

  const customerStats = (cid) => {
    const sales = taxes.filter(t => t.customer_id === cid && t.status === 'issued' && inYear(t.date, year))
      .reduce((s, t) => s + (t.supply || 0) + (t.vat || 0), 0)
    const purchase = orders.filter(o => o.customer_id === cid && o.status === 'completed' && inYear(o.date, year))
      .reduce((s, o) => s + calcItems(o.items || []).total, 0)
    const pays = yearPays.filter(p => p.customer_id === cid)
    const remaining = pays.filter(p => p.status !== 'settled').reduce((s, p) => s + (p.remaining || 0), 0)
    const settled = pays.reduce((s, p) => s + (p.settled_amount || 0), 0)
    return { sales, purchase, remaining, settled, pays }
  }

  const titleNode = (
    <div style={{ position:'relative', display:'inline-block' }}>
      <span onClick={() => setYearOpen(o => !o)} style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 }}>
        미지급금 관리 <span style={{ fontSize:13, fontWeight:500, color:'var(--muted)' }}>({year}.01.01 ~ {year}.12.31)</span>
        <span style={{ fontSize:11, color:'var(--muted)' }}>▼</span>
      </span>
      {yearOpen && (
        <div style={{ position:'absolute', top:'100%', left:0, marginTop:6, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:4, zIndex:100, minWidth:120, boxShadow:'0 8px 24px rgba(0,0,0,.3)' }}>
          {yearOptions.map(y => (
            <div key={y} onClick={() => { setYear(y); setYearOpen(false) }}
              style={{ padding:'8px 14px', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight: y===year?700:400, color: y===year?'var(--accent)':'var(--text)' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{y}년</div>
          ))}
        </div>
      )}
    </div>
  )

  const cardStyle = (active) => ({ cursor:'pointer', outline: active ? '2px solid var(--accent)' : 'none', borderRadius:10 })

  return renderLayout(
    <div style={{ display:'flex', gap:8 }}>
      <Btn variant="primary" onClick={() => setAddOpen(true)}>+ 수동 추가</Btn>
      <Btn variant="secondary" onClick={handleExport}>CSV 내보내기</Btn>
    </div>,
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        <div onClick={()=>setView('unsettled')} style={cardStyle(view==='unsettled')}>
          <StatCard label="미지급 잔액 (클릭: 미지급내역)" value={fmtW(totalRemaining)} sub={`${yearPays.filter(p=>p.status!=='settled').length}건`} color="var(--danger)" />
        </div>
        <div onClick={()=>setView('settled')} style={cardStyle(view==='settled')}>
          <StatCard label="지급완료 (클릭: 완료내역)" value={fmtW(totalSettled)} sub={`${yearPays.filter(p=>p.status==='settled').length}건`} color="var(--success)" />
        </div>
        <div onClick={()=>setView('all')} style={cardStyle(view==='all')}>
          <StatCard label="전체 (클릭: 전체보기)" value={`${yearPays.length}건`} sub={year + '년'} color="var(--accent)" />
        </div>
      </div>

      <TableWrap title={view==='settled'?'지급완료 내역':view==='all'?'전체 내역':'미지급 내역'} count={shown.length}
        searchVal={search} onSearch={setSearch}>
        <thead>
          <tr>
            <Th>거래처</Th><Th>발주서번호</Th><Th right>지급금액</Th><Th>지급예정일</Th>
            <Th right>잔액</Th><Th>상태</Th><Th>메모</Th><Th></Th>
          </tr>
        </thead>
        <tbody>
          {shown.map(p => (
            <tr key={p.id}>
              <Td><span style={{ cursor:'pointer', color:'var(--accent)' }} onClick={() => setDetail(customers.find(c=>c.id===p.customer_id)||{id:p.customer_id,name:p.customer_name})}>{p.customer_name}</span></Td>
              <Td mono>{p.order_id || '-'}</Td>
              <Td mono right>{fmtW(p.amount)}</Td>
              <Td>{p.due_date}</Td>
              <Td mono right accent>{fmtW(p.remaining)}</Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td>{p.note}</Td>
              <Td>
                <div style={{ display:'flex', gap:4 }}>
                  {p.status !== 'settled' && (
                    <Btn size="sm" variant="success" onClick={() => { setSettleOpen(p); setSettleForm({ settled_amount: p.remaining, settled_date: today(), note: '' }) }}>정산</Btn>
                  )}
                  <Btn size="sm" variant="danger" onClick={() => handleDelete(p.id)}>삭제</Btn>
                </div>
              </Td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr><td colSpan={8} style={{ padding:32, textAlign:'center', color:'var(--muted)', fontSize:13 }}>내역이 없습니다</td></tr>
          )}
        </tbody>
      </TableWrap>

      {/* 거래처 상세 */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`${detail?.name || ''} — ${year}년 거래 현황`} wide>
        {detail && (() => {
          const st = customerStats(detail.id)
          return (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
                <StatCard label="연간 매출" value={fmtW(st.sales)} sub="발행 세금계산서" color="var(--accent)" />
                <StatCard label="연간 매입" value={fmtW(st.purchase)} sub="완료 발주" color="var(--warn)" />
                <StatCard label="미지급 잔액" value={fmtW(st.remaining)} sub="미정산" color="var(--danger)" />
                <StatCard label="지급완료" value={fmtW(st.settled)} sub="누적" color="var(--success)" />
              </div>
              <TableWrap title="미지급 내역" count={st.pays.length}>
                <thead><tr><Th>발주서</Th><Th right>지급</Th><Th>예정일</Th><Th right>잔액</Th><Th>상태</Th></tr></thead>
                <tbody>
                  {st.pays.map(p => (
                    <tr key={p.id}><Td mono>{p.order_id||'-'}</Td><Td mono right>{fmtW(p.amount)}</Td><Td>{p.due_date}</Td><Td mono right accent>{fmtW(p.remaining)}</Td><Td><StatusBadge status={p.status}/></Td></tr>
                  ))}
                  {st.pays.length===0 && <tr><td colSpan={5} style={{padding:24,textAlign:'center',color:'var(--muted)'}}>내역이 없습니다</td></tr>}
                </tbody>
              </TableWrap>
            </div>
          )
        })()}
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="미지급금 수동 추가">
        <FormGrid>
          <FormGroup label="거래처">
            <SearchSelect value={String(form.customer_id)} onChange={v => setForm(f => ({ ...f, customer_id: v }))} options={customers.map(c=>({value:String(c.id),label:c.name}))} placeholder="거래처명 검색" />
          </FormGroup>
          <FormGroup label="금액"><Input type="number" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} placeholder="0" /></FormGroup>
          <FormGroup label="지급예정일"><Input type="date" value={form.due_date} onChange={v => setForm(f => ({ ...f, due_date: v }))} /></FormGroup>
          <FormGroup label="발주서번호"><Input value={form.order_id} onChange={v => setForm(f => ({ ...f, order_id: v }))} placeholder="PO-2026-001" /></FormGroup>
          <FormGroup label="메모" full><Input value={form.note} onChange={v => setForm(f => ({ ...f, note: v }))} placeholder="메모" /></FormGroup>
        </FormGrid>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:20 }}>
          <Btn variant="secondary" onClick={() => setAddOpen(false)}>취소</Btn>
          <Btn variant="primary" onClick={handleAdd}>추가</Btn>
        </div>
      </Modal>

      <Modal open={!!settleOpen} onClose={() => setSettleOpen(null)} title="정산 처리">
        {settleOpen && (
          <>
            <div style={{ marginBottom:16, fontSize:13, color:'var(--muted)' }}>
              {settleOpen.customer_name} / 지급 {fmtW(settleOpen.amount)} / 잔액 {fmtW(settleOpen.remaining)}
            </div>
            <FormGrid>
              <FormGroup label="지급금액"><Input type="number" value={settleForm.settled_amount} onChange={v => setSettleForm(f => ({ ...f, settled_amount: v }))} /></FormGroup>
              <FormGroup label="지급일"><Input type="date" value={settleForm.settled_date} onChange={v => setSettleForm(f => ({ ...f, settled_date: v }))} /></FormGroup>
              <FormGroup label="메모" full><Input value={settleForm.note} onChange={v => setSettleForm(f => ({ ...f, note: v }))} placeholder="메모" /></FormGroup>
            </FormGrid>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:20 }}>
              <Btn variant="secondary" onClick={() => setSettleOpen(null)}>취소</Btn>
              <Btn variant="success" onClick={handleSettle}>정산 처리</Btn>
            </div>
          </>
        )}
      </Modal>
    </div>,
    titleNode
  )
}
