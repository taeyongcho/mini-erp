import { useState } from 'react'
import { useData } from '../context/DataContext.jsx'
import { api } from '../api.js'
import { StatCard, Btn, Badge, Modal, FormGrid, FormGroup, Input, Select, TableWrap, Th, Td, fmtW } from '../components/UI.jsx'
import { exportCSV, today, dateAdd } from '../utils/index.js'

const STATUS_LABEL = { pending: '미수', partial: '부분수금', settled: '완료' }
const STATUS_COLOR = { pending: 'var(--warn)', partial: 'var(--accent2)', settled: 'var(--success)' }

function StatusBadge({ status }) {
  return (
    <span style={{ display:'inline-flex', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:500,
      background: status === 'settled' ? 'rgba(34,197,94,.15)' : status === 'partial' ? 'rgba(0,212,168,.15)' : 'rgba(245,158,11,.15)',
      color: STATUS_COLOR[status] || 'var(--muted)' }}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

export default function ReceivablePage({ renderLayout }) {
  const { data, refresh, showToast } = useData()
  const { receivables = [], customers = [] } = data

  const [addOpen, setAddOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(null)
  const [form, setForm] = useState({ customer_id: '', amount: '', due_date: dateAdd(today(), 30), note: '' })
  const [settleForm, setSettleForm] = useState({ settled_amount: '', settled_date: today(), note: '' })

  const totalAmount = receivables.reduce((s, r) => s + (r.amount || 0), 0)
  const totalSettled = receivables.reduce((s, r) => s + (r.settled_amount || 0), 0)
  const totalRemaining = receivables.reduce((s, r) => s + (r.remaining || 0), 0)

  async function handleAdd() {
    try {
      await api.createReceivable({ ...form, customer_id: Number(form.customer_id), amount: Number(form.amount) })
      await refresh()
      setAddOpen(false)
      setForm({ customer_id: '', amount: '', due_date: dateAdd(today(), 30), note: '' })
      showToast('미수금이 추가되었습니다')
    } catch (e) { showToast(e.message, 'error') }
  }

  async function handleSettle() {
    try {
      await api.settleReceivable(settleOpen.id, { ...settleForm, settled_amount: Number(settleForm.settled_amount) })
      await refresh()
      setSettleOpen(null)
      showToast('정산 처리되었습니다')
    } catch (e) { showToast(e.message, 'error') }
  }

  async function handleDelete(id) {
    if (!confirm('삭제하시겠습니까?')) return
    try {
      await api.deleteReceivable(id)
      await refresh()
      showToast('삭제되었습니다')
    } catch (e) { showToast(e.message, 'error') }
  }

  function handleExport() {
    exportCSV('미수금.csv', [
      { key: 'customer_name', label: '거래처' },
      { key: 'tax_invoice_id', label: '세금계산서번호' },
      { key: 'amount', label: '청구금액' },
      { key: 'due_date', label: '입금예정일' },
      { key: 'remaining', label: '잔액' },
      { key: 'status', label: '상태' },
    ], receivables.map(r => ({ ...r, status: STATUS_LABEL[r.status] || r.status })))
  }

  const custOptions = [{ value: '', label: '거래처 선택' }, ...customers.map(c => ({ value: c.id, label: c.name }))]

  return renderLayout(
    <div style={{ display:'flex', gap:8 }}>
      <Btn variant="primary" onClick={() => setAddOpen(true)}>+ 수동 추가</Btn>
      <Btn variant="secondary" onClick={handleExport}>CSV 내보내기</Btn>
    </div>,
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        <StatCard label="총 미수금" value={fmtW(totalAmount)} sub={`${receivables.length}건`} color="var(--warn)" />
        <StatCard label="수금완료" value={fmtW(totalSettled)} sub="누적" color="var(--success)" />
        <StatCard label="잔액" value={fmtW(totalRemaining)} sub="미수 잔액" color="var(--accent)" />
      </div>

      <TableWrap title="미수금 목록" count={receivables.length}>
        <thead>
          <tr>
            <Th>거래처</Th>
            <Th>세금계산서번호</Th>
            <Th right>청구금액</Th>
            <Th>입금예정일</Th>
            <Th right>잔액</Th>
            <Th>상태</Th>
            <Th>메모</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {receivables.map(r => (
            <tr key={r.id}>
              <Td>{r.customer_name}</Td>
              <Td mono>{r.tax_invoice_id || '-'}</Td>
              <Td mono right>{fmtW(r.amount)}</Td>
              <Td>{r.due_date}</Td>
              <Td mono right accent>{fmtW(r.remaining)}</Td>
              <Td><StatusBadge status={r.status} /></Td>
              <Td>{r.note}</Td>
              <Td>
                <div style={{ display:'flex', gap:4 }}>
                  {r.status !== 'settled' && (
                    <Btn size="sm" variant="success" onClick={() => { setSettleOpen(r); setSettleForm({ settled_amount: r.remaining, settled_date: today(), note: '' }) }}>정산</Btn>
                  )}
                  <Btn size="sm" variant="danger" onClick={() => handleDelete(r.id)}>삭제</Btn>
                </div>
              </Td>
            </tr>
          ))}
          {receivables.length === 0 && (
            <tr><td colSpan={8} style={{ padding:32, textAlign:'center', color:'var(--muted)', fontSize:13 }}>미수금이 없습니다</td></tr>
          )}
        </tbody>
      </TableWrap>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="미수금 수동 추가">
        <FormGrid>
          <FormGroup label="거래처">
            <Select value={form.customer_id} onChange={v => setForm(f => ({ ...f, customer_id: v }))} options={custOptions} />
          </FormGroup>
          <FormGroup label="금액">
            <Input type="number" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} placeholder="0" />
          </FormGroup>
          <FormGroup label="입금예정일">
            <Input type="date" value={form.due_date} onChange={v => setForm(f => ({ ...f, due_date: v }))} />
          </FormGroup>
          <FormGroup label="메모">
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
              {settleOpen.customer_name} / 청구 {fmtW(settleOpen.amount)} / 잔액 {fmtW(settleOpen.remaining)}
            </div>
            <FormGrid>
              <FormGroup label="입금금액">
                <Input type="number" value={settleForm.settled_amount} onChange={v => setSettleForm(f => ({ ...f, settled_amount: v }))} />
              </FormGroup>
              <FormGroup label="입금일">
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
