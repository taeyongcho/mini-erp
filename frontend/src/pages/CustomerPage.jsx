import { useState } from 'react'
import { Btn, Modal, TableWrap, Th, Td, FormGrid, FormGroup, Input, toast } from '../components/UI.jsx'
import { api } from '../api.js'

export default function CustomerPage({ data, refresh, renderLayout }) {
  const { customers } = data
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const openForm = (c) => {
    setForm(c ? {...c} : {name:'',ceo:'',biz_no:'',addr:'',phone:'',email:'',type:'법인'})
    setEditId(c?.id||null); setModal(true)
  }
  const f = (k) => v => setForm(p=>({...p,[k]:v}))

  const save = async () => {
    if (!form.name) return toast('상호를 입력하세요','error')
    setSaving(true)
    try {
      if (editId) await api.updateCustomer(editId, form)
      else await api.createCustomer(form)
      toast(editId?'거래처가 수정되었습니다':'거래처가 추가되었습니다')
      await refresh(); setModal(false)
    } catch(e){ toast(e.message,'error') }
    setSaving(false)
  }

  const del = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    try { await api.deleteCustomer(id); toast('삭제되었습니다'); await refresh() } catch(e){ toast(e.message,'error') }
  }

  return renderLayout(
    <Btn variant="primary" onClick={()=>openForm()}>+ 거래처 추가</Btn>,
    <>
      <TableWrap title="거래처" count={customers.length}>
        <thead><tr><Th>상호</Th><Th>대표자</Th><Th>사업자번호</Th><Th>연락처</Th><Th>이메일</Th><Th>액션</Th></tr></thead>
        <tbody>
          {customers.map(c=><tr key={c.id}>
            <Td><span style={{fontWeight:500}}>{c.name}</span></Td>
            <Td>{c.ceo}</Td>
            <Td mono>{c.biz_no}</Td>
            <Td mono>{c.phone}</Td>
            <Td><span style={{color:'var(--muted)'}}>{c.email}</span></Td>
            <Td><div style={{display:'flex',gap:4}}>
              <Btn size="sm" onClick={()=>openForm(c)}>수정</Btn>
              <Btn size="sm" variant="danger" onClick={()=>del(c.id)}>삭제</Btn>
            </div></Td>
          </tr>)}
          {customers.length===0&&<tr><td colSpan={6} style={{textAlign:'center',padding:30,color:'var(--muted)'}}>거래처가 없습니다</td></tr>}
        </tbody>
      </TableWrap>

      <Modal open={modal} onClose={()=>setModal(false)} title={editId?'거래처 수정':'거래처 추가'}>
        <FormGrid>
          <FormGroup label="상호" full><Input value={form.name} onChange={f('name')} placeholder="(주)회사명" /></FormGroup>
          <FormGroup label="대표자"><Input value={form.ceo} onChange={f('ceo')} /></FormGroup>
          <FormGroup label="사업자번호"><Input value={form.biz_no} onChange={f('biz_no')} placeholder="000-00-00000" mono /></FormGroup>
          <FormGroup label="주소" full><Input value={form.addr} onChange={f('addr')} /></FormGroup>
          <FormGroup label="전화번호"><Input value={form.phone} onChange={f('phone')} /></FormGroup>
          <FormGroup label="이메일"><Input value={form.email} onChange={f('email')} /></FormGroup>
        </FormGrid>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
          <Btn onClick={()=>setModal(false)}>취소</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving?'저장 중...':'저장'}</Btn>
        </div>
      </Modal>
    </>
  )
}
