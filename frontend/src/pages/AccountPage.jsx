import { useState } from 'react'
import { useData } from '../context/DataContext.jsx'
import { api } from '../api.js'
import { StatCard, Btn, Modal, FormGrid, FormGroup, Input, TableWrap, Th, Td, fmtW } from '../components/UI.jsx'

export default function AccountPage({ renderLayout }) {
  const { data, refresh, showToast } = useData()
  const { accounts = [] } = data

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ bank_name: '', account_no: '', balance: '', note: '' })

  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0)

  function openAdd() {
    setEditing(null)
    setForm({ bank_name: '', account_no: '', balance: '', note: '' })
    setOpen(true)
  }

  function openEdit(a) {
    setEditing(a)
    setForm({ bank_name: a.bank_name, account_no: a.account_no, balance: a.balance, note: a.note })
    setOpen(true)
  }

  async function handleSave() {
    try {
      const payload = { ...form, balance: Number(form.balance) }
      if (editing) {
        await api.updateAccount(editing.id, payload)
        showToast('수정되었습니다')
      } else {
        await api.createAccount(payload)
        showToast('계좌가 추가되었습니다')
      }
      await refresh()
      setOpen(false)
    } catch (e) { showToast(e.message, 'error') }
  }

  async function handleDelete(id) {
    if (!confirm('삭제하시겠습니까?')) return
    try {
      await api.deleteAccount(id)
      await refresh()
      showToast('삭제되었습니다')
    } catch (e) { showToast(e.message, 'error') }
  }

  return renderLayout(
    <Btn variant="primary" onClick={openAdd}>+ 계좌 추가</Btn>,
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        <StatCard label="총 계좌잔액" value={fmtW(totalBalance)} sub={`${accounts.length}개 계좌`} color="var(--accent2)" />
      </div>

      <TableWrap title="계좌 목록" count={accounts.length}>
        <thead>
          <tr>
            <Th>은행명</Th>
            <Th>계좌번호</Th>
            <Th right>잔액</Th>
            <Th>메모</Th>
            <Th>수정일</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.id}>
              <Td>{a.bank_name}</Td>
              <Td mono>{a.account_no || '-'}</Td>
              <Td mono right accent>{fmtW(a.balance)}</Td>
              <Td>{a.note}</Td>
              <Td>{a.updated_at}</Td>
              <Td>
                <div style={{ display:'flex', gap:4 }}>
                  <Btn size="sm" variant="secondary" onClick={() => openEdit(a)}>수정</Btn>
                  <Btn size="sm" variant="danger" onClick={() => handleDelete(a.id)}>삭제</Btn>
                </div>
              </Td>
            </tr>
          ))}
          {accounts.length === 0 && (
            <tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:'var(--muted)', fontSize:13 }}>등록된 계좌가 없습니다</td></tr>
          )}
        </tbody>
        {accounts.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={2} style={{ padding:'10px 16px', fontSize:12, color:'var(--muted)', fontWeight:600 }}>합계</td>
              <td style={{ padding:'10px 16px', textAlign:'right', fontFamily:'var(--mono)', fontSize:13, fontWeight:700, color:'var(--accent)' }}>{fmtW(totalBalance)}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        )}
      </TableWrap>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? '계좌 수정' : '계좌 추가'}>
        <FormGrid>
          <FormGroup label="은행명">
            <Input value={form.bank_name} onChange={v => setForm(f => ({ ...f, bank_name: v }))} placeholder="국민은행" />
          </FormGroup>
          <FormGroup label="계좌번호">
            <Input value={form.account_no} onChange={v => setForm(f => ({ ...f, account_no: v }))} placeholder="1234-56-789012" />
          </FormGroup>
          <FormGroup label="잔액">
            <Input type="number" value={form.balance} onChange={v => setForm(f => ({ ...f, balance: v }))} placeholder="0" />
          </FormGroup>
          <FormGroup label="메모">
            <Input value={form.note} onChange={v => setForm(f => ({ ...f, note: v }))} placeholder="메모" />
          </FormGroup>
        </FormGrid>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:20 }}>
          <Btn variant="secondary" onClick={() => setOpen(false)}>취소</Btn>
          <Btn variant="primary" onClick={handleSave}>{editing ? '수정' : '추가'}</Btn>
        </div>
      </Modal>
    </div>
  )
}
