import { useState } from 'react'
import { Btn, Badge, Modal, TableWrap, Th, Td, FormGrid, FormGroup, Input, Select } from '../components/UI.jsx'
import { api } from '../api.js'
import { useData } from '../context/DataContext.jsx'
import { exportCSV, today, fmtW } from '../utils/index.js'

export default function ProductPage({ renderLayout }) {
  const { data, refresh, showToast } = useData()
  const { products } = data
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const openForm = (p) => {
    const nextCode = `PRD-${String(products.length+1).padStart(3,'0')}`
    setForm(p ? {...p} : {code:nextCode, name:'', unit:'개', price:0, tax:true})
    setEditId(p?.id||null); setModal(true)
  }
  const f = (k) => v => setForm(p=>({...p,[k]:v}))

  const save = async () => {
    if (!form.name) return showToast('품목명을 입력하세요','error')
    if (+form.price < 0) return showToast('단가는 0 이상이어야 합니다','error')
    setSaving(true)
    try {
      const payload = {...form, price:+form.price, tax: form.tax===true||form.tax==='true'}
      if (editId) await api.updateProduct(editId, payload)
      else await api.createProduct(payload)
      showToast(editId?'품목이 수정되었습니다':'품목이 추가되었습니다')
      await refresh(); setModal(false)
    } catch(e){ showToast(e.message,'error') }
    setSaving(false)
  }

  const del = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    try { await api.deleteProduct(id); showToast('삭제되었습니다'); await refresh() } catch(e){ showToast(e.message,'error') }
  }

  const doExportCSV = () => {
    exportCSV(`products_${today()}.csv`, [
      {key:'code', label:'코드'},
      {key:'name', label:'품목명'},
      {key:'unit', label:'단위'},
      {key:'price', label:'단가'},
      {key:'taxLabel', label:'과세여부'},
    ], products.map(p=>({...p, taxLabel: p.tax ? '과세' : '면세'})))
  }

  return renderLayout(
    <div style={{display:'flex',gap:8}}>
      <Btn onClick={doExportCSV}>CSV 내보내기</Btn>
      <Btn variant="primary" onClick={()=>openForm()}>+ 품목 추가</Btn>
    </div>,
    <>
      <TableWrap title="품목 목록" count={products.length}>
        <thead><tr><Th>품목코드</Th><Th>품목명</Th><Th>단위</Th><Th right>단가</Th><Th>부가세</Th><Th>액션</Th></tr></thead>
        <tbody>
          {products.map(p=><tr key={p.id}>
            <Td mono accent>{p.code}</Td>
            <Td><span style={{fontWeight:500}}>{p.name}</span></Td>
            <Td>{p.unit}</Td>
            <Td right>{fmtW(p.price)}</Td>
            <Td><Badge status={p.tax?'approved':'draft'} /></Td>
            <Td><div style={{display:'flex',gap:4}}>
              <Btn size="sm" onClick={()=>openForm(p)}>수정</Btn>
              <Btn size="sm" variant="danger" onClick={()=>del(p.id)}>삭제</Btn>
            </div></Td>
          </tr>)}
          {products.length===0&&<tr><td colSpan={6} style={{textAlign:'center',padding:30,color:'var(--muted)'}}>품목이 없습니다</td></tr>}
        </tbody>
      </TableWrap>

      <Modal open={modal} onClose={()=>setModal(false)} title={editId?'품목 수정':'품목 추가'}>
        <FormGrid>
          <FormGroup label="품목코드"><Input value={form.code} onChange={f('code')} mono /></FormGroup>
          <FormGroup label="품목명" full><Input value={form.name} onChange={f('name')} /></FormGroup>
          <FormGroup label="단위"><Input value={form.unit} onChange={f('unit')} placeholder="개/시간/월" /></FormGroup>
          <FormGroup label="단가 (원)"><Input type="number" value={form.price} onChange={f('price')} /></FormGroup>
          <FormGroup label="과세여부">
            <Select value={String(form.tax)} onChange={v=>setForm(p=>({...p,tax:v==='true'}))} options={[{value:'true',label:'과세'},{value:'false',label:'면세'}]} />
          </FormGroup>
        </FormGrid>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
          <Btn onClick={()=>setModal(false)}>취소</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving?'저장 중...':'저장'}</Btn>
        </div>
      </Modal>
    </>
  )
}
