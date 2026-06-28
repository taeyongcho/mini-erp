import { useState } from 'react'
import { useData } from '../context/DataContext.jsx'
import { api } from '../api.js'
import { StatCard, Btn, Modal, FormGrid, FormGroup, Input, Select, TableWrap, Th, Td, fmtW } from '../components/UI.jsx'
import { exportCSV, today, dateAdd } from '../utils/index.js'

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

export default function PayablePage({ renderLayout }) {
  const { data, refresh, showToast } = useData()
  const { payables = [], customers = [] } = data

  const [addOpen, setAddOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(null)
  const [form, setForm] = useState({ customer_id: '', amount: '', due_date: dateAdd(today(), 30), order_id: '', note: '' })
  const [settleForm, setSettleForm] = useState({ settled_amount: '', settled_date: today(), note: '' })

  const totalAmount = payables.reduce((s, p) => s + (p.amount || 0), 0)
  const totalSettled = payables.reduce((s, p) => s + (p.settled_amount || 0), 0)
  const totalRemaining = payables.reduce((s, p) => s + (p.remaining || 0), 0)

  async function handleAdd() {
    if (!form.customer_id) return showToast('거래처를 선택하세요', 'error')
    if (!(Number(form.amount) > 0)) return showToast('금액은 0보다 커야 합니다', 'error')
    try {
      await api.createPayable({ ...form, customer_id: Number(form.customer_id), amount: Number(form.amount), order_id: form.order_id || null })
      await refresh()
      setAddOpen(false)
      setForm({ customer_id: '', amount: '', due_date: dateAdd(today(), 30), order_id: '', note: '' })
      showToast('미지급금이 추가되었습니다')
    } catch (e) { showToast(e.message, 'error') }
  }

  async function handleSettle() {
    const billable = (settleOpen.remaining || 0) + (settleOpen.settled_amount || 0)
    if (Number(settleForm.settled_amount) > billable) return showToast('지급액이 청구금액을 초과할 수 없습니다', 'error')
    try {
      await api.settlePayable(settleOpen.id, { ...settleForm, settled_amount: Number(settleForm.settled_amount) })
      await refresh()
      setSettleOpen(null)
      showToast('정산 처리되었습니다')
    } catch (e) { showToast(e.message, 'error') }
  }

  async function handleDelete(id) {
    if (!confirm('삭제하시겠습니까?')) return
    try {
      await api.deletePayable(id)
      await refresh()
      showToast('삭제되었습니다')
    } catch (e) { showToast(e.message, 'error') }
  }

  function handleExport() {
    exportCSV('미지급금.csv', [
      { key: 'customer_name', label: '거래처' },
      { key: 'order_id', label: '발주서번호' },
      { key: 'amount', label: '지급금액' },
      { key: 'due_date', label: '지급예정일' },
      { key: 'remaining', label: '잔액' },
      { key: 'status', label: '상태' },
    ], payables.map(p => ({ ...p, status: STATUS_LABEL[p.status] || p.status })))
  }

  const custOptions = [{ value: '', label: '거래처 선택' }, ...customers.map(c => ({ value: c.id, label: c.name }))]

  return renderLayout(
    <div style={{ display:'flex', gap:8 }}>
      <Btn variant="primary" onClick={() => setAddOpen(true)}>+ 수동 추가</Btn>
      <Btn variant="secondary" onClick={handleExport}>CSV 내보내기</Btn>
    </div>,
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        <StatCard label="총 미지급금" value={fmtW(totalAmount)} sub={`${payables.length}건`} color="var(--danger)" />
        <StatCard label="지급완료" value={fmtW(totalSettled)} sub="누적" color="var(--success)" />
        <StatCard label="잔액" value={fmtW(totalRemaining)} sub="미지급 잔액" color="var(--accent)" />
      </div>

      <TableWrap title="미지급금 목록" count={payables.length}>
        <thead>
          <tr>
            <Th>거래처</Th>
            <Th>발주서번호</Th>
            <Th right>지급금액</Th>
            <Th>지급예정일</Th>
            <Th right>잔액</Th>
            <Th>상태</Th>
            <Th>메모</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {payables.map(p => (
            <tr key={p.id}>
              <Td>{p.customer_name}</Td>
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
          {payables.length === 0 && (
            <tr><td colSpan={8} style={{ padding:32, textAlign:'center', color:'var(--muted)', fontSize:13 }}>미지급금이 없습니다</td></tr>
          )}
        </tbody>
      </TableWrap>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="미지급금 수동 추가">
        <FormGrid>
          <FormGroup label="거래처">
            <Select value={form.customer_id} onChange={v => setForm(f => ({ ...f, customer_id: v }))} options={custOptions} />
          </FormGroup>
          <FormGroup label="금액">
            <Input type="number" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} placeholder="0" />
          </FormGroup>
          <FormGroup label="지급예정일">
            <Input type="date" value={form.due_date} onChange={v => setForm(f => ({ ...f, due_date: v }))} />
          </FormGroup>
          <FormGroup label="발주서번호">
            <Input value={form.order_id} onChange={v => setForm(f => ({ ...f, order_id: v }))} placeholder="PO-2026-001" />
          </FormGroup>
          <FormGroup label="메모" full>
            <Input value={form.note} onChange={v => setForm(f => ({ ...f, note: v }))} placeholder="메모" />
          </FormGroup>
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
              <FormGroup label="지급금액">
                <Input type="number" value={settleForm.settled_amount} onChange={v => setSettleForm(f => ({ ...f, settled_amount: v }))} />
              </FormGroup>
              <FormGroup label="지급일">
                <Input type="date" value={settleForm.settled_date} onChange={v => setSettleForm(f => ({ ...f, settled_date: v }))} />
              </FormGroup>
              <FormGroup label="메모" full>
                <Input value={settleForm.note} onChange={v => setSettleForm(f => ({ ...f, note: v }))} placeholder="메모" />
              </FormGroup>
            </FormGrid>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:20 }}>
              <Btn variant="secondary" onClick={() => setSettleOpen(null)}>취소</Btn>
              <Btn variant="success" onClick={handleSettle}>정산 처리</Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
