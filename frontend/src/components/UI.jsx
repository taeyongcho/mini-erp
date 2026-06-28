import { useState, useEffect } from 'react'

const s = {
  app: { display:'flex', height:'100vh', overflow:'hidden' },
  sidebar: { width:220, minWidth:220, background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflowY:'auto' },
  logo: { padding:'20px 20px 16px', borderBottom:'1px solid var(--border)', fontWeight:700, fontSize:15, display:'flex', alignItems:'center', gap:10 },
  logoMark: { width:30, height:30, borderRadius:8, background:'linear-gradient(135deg,var(--accent),var(--accent2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff' },
  sideSection: { padding:'14px 12px 6px', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1 },
  navItem: (active) => ({ display:'flex', alignItems:'center', gap:10, padding:'9px 16px', cursor:'pointer', borderRadius:6, margin:'1px 8px', color: active ? 'var(--accent)' : 'var(--label)', fontSize:13, background: active ? 'rgba(79,143,255,.15)' : 'transparent', transition:'all .15s' }),
  navBadge: { marginLeft:'auto', background:'var(--accent)', color:'#fff', fontSize:10, fontFamily:'var(--mono)', padding:'1px 6px', borderRadius:10 },
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  topbar: { height:56, background:'var(--surface)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', padding:'0 24px', gap:16, flexShrink:0 },
  topbarTitle: { fontSize:16, fontWeight:700, flex:1 },
  topbarActions: { display:'flex', gap:8 },
  content: { flex:1, overflowY:'auto', padding:24 },
}

export function getTheme() {
  return localStorage.getItem('erp_theme') || 'dark'
}
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('erp_theme', theme)
}
export function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme())
  const toggle = () => { const t = theme === 'dark' ? 'light' : 'dark'; applyTheme(t); setTheme(t) }
  return (
    <button onClick={toggle} title={theme === 'dark' ? '라이트 모드로' : '다크 모드로'}
      style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontSize:14, color:'var(--text)' }}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}

export function Layout({ page, onNav, topbarActions, children, badges, title }) {
  const nav = (id, icon, label) => (
    <div style={s.navItem(page===id)} onClick={() => onNav(id)}
      onMouseEnter={e => { if(page!==id) { e.currentTarget.style.background='var(--surface2)'; e.currentTarget.style.color='var(--text)' }}}
      onMouseLeave={e => { if(page!==id) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--label)' }}}>
      <span style={{width:18,textAlign:'center',fontSize:15}}>{icon}</span>
      <span>{label}</span>
      {badges?.[id] > 0 && <span style={s.navBadge}>{badges[id]}</span>}
    </div>
  )
  const titles = { dashboard:'대시보드', quotation:'견적서 관리', contract:'계약서 관리', order:'발주서 관리', tax:'세금계산서 관리', customer:'거래처 관리', product:'품목 관리', receivable:'미수금 관리', payable:'미지급금 관리', account:'계좌 관리', convert:'견적 변환', profile:'내 정보 관리' }
  return (
    <div style={s.app}>
      <nav style={s.sidebar}>
        <div style={s.logo}><div style={s.logoMark}>E</div>영업 ERP</div>
        <div style={s.sideSection}>메인</div>
        {nav('dashboard','📊','대시보드')}
        <div style={s.sideSection}>영업문서</div>
        {nav('quotation','📋','견적서')}
        {nav('contract','📝','계약서')}
        {nav('order','📦','발주서')}
        {nav('tax','🧾','세금계산서')}
        <div style={s.sideSection}>자금관리</div>
        {nav('receivable','💰','미수금')}
        {nav('payable','💸','미지급금')}
        {nav('account','🏦','계좌관리')}
        {nav('convert','🔄','견적변환')}
        <div style={s.sideSection}>관리</div>
        {nav('customer','🏢','거래처')}
        {nav('product','🗂️','품목관리')}
        <div style={s.sideSection}>계정</div>
        {nav('profile','⚙️','내 정보')}
      </nav>
      <div style={s.main}>
        <div style={s.topbar}>
          <div style={s.topbarTitle}>{title || titles[page] || ''}</div>
          <div style={s.topbarActions}>{topbarActions}</div>
        </div>
        <div style={s.content}>{children}</div>
      </div>
    </div>
  )
}

export function Btn({ children, onClick, variant='secondary', size='md', disabled, type='button', style: sx }) {
  const base = { padding: size==='sm' ? '4px 10px' : '7px 16px', borderRadius:6, border:'none', cursor: disabled?'default':'pointer', fontFamily:'var(--sans)', fontSize: size==='sm'?11:12, fontWeight:500, display:'inline-flex', alignItems:'center', gap:6, opacity: disabled ? 0.5 : 1 }
  const variants = { primary:{background:'var(--accent)',color:'#fff'}, secondary:{background:'var(--surface2)',color:'var(--text)',border:'1px solid var(--border)'}, success:{background:'var(--success)',color:'#fff'}, danger:{background:'var(--danger)',color:'#fff'}, warn:{background:'var(--warn)',color:'#000'} }
  return <button type={type} style={{...base,...(variants[variant]||variants.secondary),...sx}} onClick={disabled?undefined:onClick}>{children}</button>
}

export function Badge({ status }) {
  const map = { draft:['작성중','rgba(100,116,139,.2)','var(--muted)'], sent:['발송완료','rgba(34,197,94,.15)','var(--success)'], approved:['승인','rgba(34,197,94,.15)','var(--success)'], rejected:['거절','rgba(239,68,68,.15)','var(--danger)'], ordered:['발주','rgba(245,158,11,.15)','var(--warn)'], completed:['완료','rgba(0,212,168,.15)','var(--accent2)'], issued:['발행완료','rgba(34,197,94,.15)','var(--success)'], pending:['미발행','rgba(245,158,11,.15)','var(--warn)'] }
  const [label, bg, color] = map[status] || ['', 'transparent', 'var(--muted)']
  return <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:500, background:bg, color }}>{label}</span>
}

export function PlanBadge({ plan }) {
  const map = {
    free: ['무료', 'rgba(100,116,139,.2)', 'var(--muted)'],
    pro: ['PRO', 'rgba(0,212,168,.18)', 'var(--accent2)'],
  }
  const [label, bg, color] = map[plan] || map.free
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: '.5px', background: bg, color }}>{label}</span>
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => { if(e.target===e.currentTarget) onClose() }}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, width: wide ? 960 : 820, maxWidth:'100%', maxHeight:'90vh', overflowY:'auto', padding:28 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <h2 style={{ fontSize:16, fontWeight:700 }}>{title}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

let _toastFn = null
export function setToastFn(fn) { _toastFn = fn }
export function toast(msg, type='success') { _toastFn && _toastFn(msg, type) }

export function ToastContainer() {
  const [toasts, setToasts] = useState([])
  useEffect(() => { setToastFn((msg, type) => { const id = Date.now(); setToasts(p => [...p, {id,msg,type}]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000) }) }, [])
  return (
    <div style={{ position:'fixed', top:20, right:20, zIndex:9999, display:'flex', flexDirection:'column', gap:8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background:'var(--surface)', border:`1px solid ${t.type==='success'?'var(--success)':'var(--danger)'}`, borderRadius:8, padding:'12px 18px', fontSize:12, minWidth:240, display:'flex', alignItems:'center', gap:10, boxShadow:'0 8px 24px rgba(0,0,0,.4)' }}>
          <span>{t.type==='success'?'✅':'❌'}</span>{t.msg}
        </div>
      ))}
    </div>
  )
}

export function FormGrid({ children, cols=2 }) {
  return <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap:16 }}>{children}</div>
}
export function FormGroup({ label, children, full }) {
  return <div style={{ display:'flex', flexDirection:'column', gap:6, gridColumn: full ? '1/-1' : undefined }}>
    <label style={{ fontSize:11, color:'var(--label)', textTransform:'uppercase', letterSpacing:'.6px' }}>{label}</label>
    {children}
  </div>
}
export function Input({ value, onChange, type='text', placeholder, readOnly, mono, style: sx }) {
  return <input type={type} value={value||''} onChange={e=>onChange&&onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly}
    style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'9px 12px', color: mono ? 'var(--accent)' : 'var(--text)', fontFamily: mono ? 'var(--mono)' : 'var(--sans)', fontSize:13, outline:'none', width:'100%', ...sx }} />
}
export function Select({ value, onChange, options }) {
  return <select value={value||''} onChange={e=>onChange(e.target.value)}
    style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'9px 12px', color:'var(--text)', fontFamily:'var(--sans)', fontSize:13, outline:'none' }}>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
}

export function TableWrap({ title, count, searchVal, onSearch, filterEl, children }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12 }}>
        <h3 style={{ fontSize:13, fontWeight:600, flex:1 }}>{title} ({count}건)</h3>
        {onSearch && <input value={searchVal||''} onChange={e=>onSearch(e.target.value)} placeholder="검색..."
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 12px', color:'var(--text)', fontFamily:'var(--sans)', fontSize:12, width:200, outline:'none' }} />}
        {filterEl}
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>{children}</table>
      </div>
    </div>
  )
}
export const Th = ({children, right}) => <th style={{ padding:'10px 16px', textAlign: right?'right':'left', fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.7px', borderBottom:'1px solid var(--border)', background:'var(--surface2)', whiteSpace:'nowrap' }}>{children}</th>
export const Td = ({children, mono, right, accent}) => <td style={{ padding:'11px 16px', borderBottom:'1px solid rgba(42,48,80,.5)', fontSize:12, fontFamily: mono?'var(--mono)':'var(--sans)', textAlign: right?'right':'left', color: accent?'var(--accent)':undefined }}>{children}</td>

export function LineEditor({ items, onChange }) {
  const update = (i, field, val) => { const next=[...items]; next[i]={...next[i],[field]:val}; onChange(next) }
  const addRow = () => onChange([...items, { name:'', qty:'', price:'' }])
  const remove = (i) => onChange(items.filter((_,j)=>j!==i))
  const cellInput = (i, field, { num=false, right=false, ph='' }={}) => (
    <input value={items[i]?.[field]??''} placeholder={ph} inputMode={num?'numeric':'text'}
      onChange={e=>{ const v=e.target.value; update(i, field, num ? v.replace(/[^0-9.]/g,'') : v) }}
      style={{ background:'transparent', border:'1px solid transparent', borderRadius:4, padding:'5px 8px', color:'var(--text)', fontFamily: num?'var(--mono)':'var(--sans)', fontSize:12, outline:'none', width:'100%', textAlign:right?'right':'left' }}
      onFocus={e=>{ e.target.style.borderColor='var(--border)'; e.target.style.background='var(--surface2)' }}
      onBlur={e=>{ e.target.style.borderColor='transparent'; e.target.style.background='transparent' }} />
  )
  return (
    <div style={{ margin:'20px 0' }}>
      <div style={{ fontSize:12, color:'var(--label)', textTransform:'uppercase', letterSpacing:'.7px', marginBottom:10 }}>품목 명세</div>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr>{[['품목명','left'],['수량','right'],['단가(원)','right'],['금액(원)','right'],['','right']].map(([h,al],i)=><th key={i} style={{ padding:'8px 10px', fontSize:10, color:'var(--muted)', textAlign:al, borderBottom:'1px solid var(--border)', background:'var(--surface2)' }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {items.map((it,i)=>(
            <tr key={i} style={{ borderBottom:'1px solid rgba(42,48,80,.4)' }}>
              <td style={{ padding:'4px 4px', width:'48%' }}>{cellInput(i,'name',{ph:'품목명 입력'})}</td>
              <td style={{ padding:'4px 4px', width:'13%' }}>{cellInput(i,'qty',{num:true,right:true,ph:'0'})}</td>
              <td style={{ padding:'4px 4px', width:'20%' }}>{cellInput(i,'price',{num:true,right:true,ph:'0'})}</td>
              <td style={{ padding:'4px 8px', width:'17%', fontFamily:'var(--mono)', fontSize:12, textAlign:'right', color:'var(--accent)' }}>{((Number(it.qty)||0)*(Number(it.price)||0)).toLocaleString('ko-KR')}</td>
              <td style={{ padding:'4px 8px', width:36, textAlign:'right' }}><button onClick={()=>remove(i)} title="행 삭제" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:14 }}>🗑</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{marginTop:8}}><Btn size="sm" onClick={addRow}>+ 행 추가</Btn></div>
    </div>
  )
}

// 검색형 선택 (거래처 등 항목이 많을 때 타이핑으로 필터)
export function SearchSelect({ value, onChange, options, placeholder='검색...' }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const sel = options.find(o => String(o.value) === String(value))
  const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase())) : options
  return (
    <div style={{ position:'relative' }}>
      <input value={open ? q : (sel?.label || '')} placeholder={placeholder}
        onFocus={()=>{ setOpen(true); setQ('') }}
        onChange={e=>setQ(e.target.value)}
        onBlur={()=>setTimeout(()=>setOpen(false), 150)}
        style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'9px 12px', color:'var(--text)', fontFamily:'var(--sans)', fontSize:13, outline:'none', width:'100%' }} />
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:4, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, maxHeight:220, overflowY:'auto', zIndex:50, boxShadow:'0 8px 24px rgba(0,0,0,.3)' }}>
          {filtered.length===0 && <div style={{ padding:'10px 12px', fontSize:12, color:'var(--muted)' }}>검색 결과 없음</div>}
          {filtered.map(o => (
            <div key={o.value} onMouseDown={()=>{ onChange(String(o.value)); setOpen(false) }}
              style={{ padding:'9px 12px', fontSize:13, cursor:'pointer', color: String(o.value)===String(value)?'var(--accent)':'var(--text)' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Summary({ items }) {
  const supply = items.reduce((s,i)=>s+(+(i.qty||0))*(+(i.price||0)),0)
  const vat = Math.round(supply*0.1)
  const W = n => `₩${n.toLocaleString('ko-KR')}`
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
      <div style={{ minWidth:280, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:12, color:'var(--label)' }}><span>공급가액</span><span style={{ fontFamily:'var(--mono)', color:'var(--text)' }}>{W(supply)}</span></div>
        <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:12, color:'var(--label)' }}><span>부가세 (10%)</span><span style={{ fontFamily:'var(--mono)', color:'var(--text)' }}>{W(vat)}</span></div>
        <div style={{ borderTop:'1px solid var(--border)', marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between', fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)', fontSize:15 }}><span style={{ fontSize:12, color:'var(--label)', fontFamily:'var(--sans)', fontWeight:400 }}>합계금액</span>{W(supply+vat)}</div>
      </div>
    </div>
  )
}

export function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'18px 20px' }}>
      <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:8 }}>{label}</div>
      <div style={{ fontFamily:'var(--mono)', fontSize:22, fontWeight:600, color: color||'var(--text)' }}>{value}</div>
      <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{sub}</div>
    </div>
  )
}

export const fmt = n => (n||0).toLocaleString('ko-KR')
export const fmtW = n => `₩${fmt(n)}`
export const calcItems = items => {
  const supply = items.reduce((s,i)=>s+(+(i.qty||0))*(+(i.price||0)),0)
  const vat = Math.round(supply*0.1)
  return { supply, vat, total: supply+vat }
}
export const today = () => new Date().toISOString().slice(0,10)
export const dateAdd = (d,days) => { const dt=new Date(d); dt.setDate(dt.getDate()+days); return dt.toISOString().slice(0,10) }
