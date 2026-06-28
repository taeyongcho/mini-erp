import { useState } from 'react'
import { Btn, Modal, TableWrap, Th, Td, FormGrid, FormGroup, Input } from '../components/UI.jsx'
import { api } from '../api.js'
import { useData } from '../context/DataContext.jsx'
import { CUSTOMER_TYPES } from '../constants/index.js'
import { exportCSV, today, isBizNo, isPhone, isEmail } from '../utils/index.js'

export default function CustomerPage({ renderLayout }) {
  const { data, refresh, showToast } = useData()
  const { customers } = data
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const openForm = (c) => {
    setForm(c ? {...c} : {name:'',ceo:'',biz_no:'',addr:'',phone:'',email:'',type:'법인',biz_type:'',biz_item:'',tax_manager:'',tax_phone:'',tax_email:''})
    setEditId(c?.id||null); setModal(true)
  }
  const f = (k) => v => setForm(p=>({...p,[k]:v}))

  const save = async () => {
    if (!form.name) return showToast('상호를 입력하세요','error')
    if (!isBizNo(form.biz_no)) return showToast('사업자번호 형식이 올바르지 않습니다 (000-00-00000)','error')
    if (!isPhone(form.phone)) return showToast('전화번호는 숫자와 하이픈만 입력하세요','error')
    if (!isEmail(form.email)) return showToast('이메일 형식이 올바르지 않습니다','error')
    if (!isEmail(form.tax_email)) return showToast('계산서 수신 메일 형식이 올바르지 않습니다','error')
    setSaving(true)
    try {
      if (editId) await api.updateCustomer(editId, form)
      else await api.createCustomer(form)
      showToast(editId?'거래처가 수정되었습니다':'거래처가 추가되었습니다')
      await refresh(); setModal(false)
    } catch(e){ showToast(e.message,'error') }
    setSaving(false)
  }

  const del = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    try { await api.deleteCustomer(id); showToast('삭제되었습니다'); await refresh() } catch(e){ showToast(e.message,'error') }
  }

  const doExportCSV = () => {
    exportCSV(`customers_${today()}.csv`, [
      {key:'name', label:'거래처명'},
      {key:'ceo', label:'대표자'},
      {key:'biz_no', label:'사업자번호'},
      {key:'addr', label:'주소'},
      {key:'phone', label:'전화'},
      {key:'email', label:'이메일'},
      {key:'type', label:'구분'},
      {key:'biz_type', label:'업태'},
      {key:'biz_item', label:'종목'},
      {key:'tax_manager', label:'계산서담당자'},
      {key:'tax_phone', label:'계산서담당연락처'},
      {key:'tax_email', label:'계산서수신메일'},
    ], customers)
  }

  return renderLayout(
    <div style={{display:'flex',gap:8}}>
      <Btn onClick={doExportCSV}>CSV 내보내기</Btn>
      <Btn variant="primary" onClick={()=>openForm()}>+ 거래처 추가</Btn>
    </div>,
    <>
      <TableWrap title="거래처" count={customers.length}>
        <thead><tr><Th>상호</Th><Th>대표자</Th><Th>사업자번호</Th><Th>구분</Th><Th>연락처</Th><Th>이메일</Th><Th>액션</Th></tr></thead>
        <tbody>
          {customers.map(c=><tr key={c.id}>
            <Td><span style={{fontWeight:500}}>{c.name}</span></Td>
            <Td>{c.ceo}</Td>
            <Td mono>{c.biz_no}</Td>
            <Td>{c.type}</Td>
            <Td mono>{c.phone}</Td>
            <Td><span style={{color:'var(--muted)'}}>{c.email}</span></Td>
            <Td><div style={{display:'flex',gap:4}}>
              <Btn size="sm" onClick={()=>openForm(c)}>수정</Btn>
              <Btn size="sm" variant="danger" onClick={()=>del(c.id)}>삭제</Btn>
            </div></Td>
          </tr>)}
          {customers.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:30,color:'var(--muted)'}}>거래처가 없습니다</td></tr>}
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
          <FormGroup label="구분">
            <select value={form.type||'법인'} onChange={e=>setForm(p=>({...p,type:e.target.value}))}
              style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'9px 12px',color:'var(--text)',fontSize:13,outline:'none',width:'100%'}}>
              {CUSTOMER_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="업태"><Input value={form.biz_type} onChange={f('biz_type')} placeholder="예: 도소매" /></FormGroup>
          <FormGroup label="종목"><Input value={form.biz_item} onChange={f('biz_item')} placeholder="예: 소프트웨어" /></FormGroup>

          <FormGroup label="계산서 수신 담당자" full><Input value={form.tax_manager} onChange={f('tax_manager')} placeholder="담당자명" /></FormGroup>
          <FormGroup label="계산서 담당 연락처"><Input value={form.tax_phone} onChange={f('tax_phone')} placeholder="010-0000-0000" /></FormGroup>
          <FormGroup label="계산서 수신 메일"><Input value={form.tax_email} onChange={f('tax_email')} placeholder="tax@company.com" /></FormGroup>
        </FormGrid>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
          <Btn onClick={()=>setModal(false)}>취소</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving?'저장 중...':'저장'}</Btn>
        </div>
      </Modal>
    </>
  )
}
