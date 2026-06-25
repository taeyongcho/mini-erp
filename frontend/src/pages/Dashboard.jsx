import { StatCard, Badge, fmtW } from '../components/UI.jsx'
import { useData } from '../context/DataContext.jsx'
import { calcItems } from '../utils/index.js'

const CONTRACT_STATUS = { reviewing:'검토중', waiting_sign:'서명대기', active:'계약중', renewing:'갱신예정', expired:'만료', terminated:'해지' }
const CONTRACT_COLOR = { reviewing:'var(--muted)', waiting_sign:'var(--accent)', active:'var(--success)', renewing:'var(--accent2)', expired:'var(--warn)', terminated:'var(--danger)' }

export default function Dashboard({ onNav, renderLayout }) {
  const { data } = useData()
  const { quotations, contracts, orders, taxes, customers } = data
  const totalQ = quotations.reduce((s,q)=>s+calcItems(q.items||[]).total,0)
  const totalC = contracts.reduce((s,c)=>s+(c.amount||0),0)
  const totalO = orders.reduce((s,o)=>s+calcItems(o.items||[]).total,0)
  const totalT = taxes.reduce((s,t)=>s+(t.supply||0)+(t.vat||0),0)
  const pendingTax = taxes.filter(t=>t.status==='pending').length
  const waitingSign = contracts.filter(c=>c.status==='waiting_sign').length
  const expiringSoon = contracts.filter(c=>c.status==='active'&&c.days_left!==null&&c.days_left>=0&&c.days_left<=30).length

  const RecentItem = ({ icon, iconBg, name, sub, amount, badge, onClick }) => (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom:'1px solid rgba(42,48,80,.4)', cursor:'pointer' }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      <div style={{ width:32, height:32, borderRadius:8, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{icon}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, fontWeight:500 }}>{name}</div>
        <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{sub} {badge}</div>
      </div>
      <div style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--accent)' }}>{amount}</div>
    </div>
  )

  const Box = ({ title, children }) => (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
      <h3 style={{ padding:'14px 18px', fontSize:13, fontWeight:600, borderBottom:'1px solid var(--border)' }}>{title}</h3>
      {children}
    </div>
  )

  return renderLayout(null, (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        <StatCard label="견적 총액" value={fmtW(totalQ)} sub={`${quotations.length}건`} color="var(--accent)" />
        <StatCard label="계약 총액" value={fmtW(totalC)} sub={`서명대기 ${waitingSign}건`} color="var(--accent2)" />
        <StatCard label="발주 총액" value={fmtW(totalO)} sub={`${orders.length}건`} color="var(--warn)" />
        <StatCard label="세금계산서" value={fmtW(totalT)} sub={`미발행 ${pendingTax}건`} color="var(--success)" />
      </div>

      {expiringSoon > 0 && (
        <div style={{ background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.3)', borderRadius:8, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <span>⚠️</span>
          <span style={{ fontSize:12, color:'var(--warn)' }}>만료 30일 이내 계약 <strong>{expiringSoon}건</strong>이 있습니다</span>
          <button onClick={()=>onNav('contract')} style={{ marginLeft:'auto', background:'none', border:'1px solid var(--warn)', color:'var(--warn)', borderRadius:6, padding:'4px 12px', fontSize:11, cursor:'pointer', fontFamily:'var(--sans)' }}>확인하기</button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:20 }}>
        <div>
          <Box title="📋 최근 견적서">
            {quotations.slice(-4).reverse().map(q => {
              const c = customers.find(x=>x.id===q.customer_id)||{}
              return <RecentItem key={q.id} icon="📋" iconBg="rgba(79,143,255,.15)" name={`${c.name} — ${q.id}`} sub={q.date}
                badge={<span style={{display:'inline-flex',padding:'1px 6px',borderRadius:10,fontSize:10,background:'rgba(79,143,255,.15)',color:'var(--accent)'}}>{({draft:'초안',sent:'발송',approved:'승인',rejected:'거절'})[q.status]}</span>}
                amount={fmtW(calcItems(q.items||[]).total)} onClick={()=>onNav('quotation')} />
            })}
            {quotations.length===0&&<div style={{padding:20,color:'var(--muted)',textAlign:'center'}}>견적서가 없습니다</div>}
          </Box>
          <Box title="📦 최근 발주서">
            {orders.slice(-3).reverse().map(o => {
              const c = customers.find(x=>x.id===o.customer_id)||{}
              return <RecentItem key={o.id} icon="📦" iconBg="rgba(245,158,11,.15)" name={`${c.name} — ${o.id}`} sub={o.date}
                badge={<span style={{display:'inline-flex',padding:'1px 6px',borderRadius:10,fontSize:10,background:'rgba(245,158,11,.15)',color:'var(--warn)'}}>{o.status==='ordered'?'발주':'완료'}</span>}
                amount={fmtW(calcItems(o.items||[]).total)} onClick={()=>onNav('order')} />
            })}
            {orders.length===0&&<div style={{padding:20,color:'var(--muted)',textAlign:'center'}}>발주서가 없습니다</div>}
          </Box>
        </div>
        <div>
          <Box title="📝 계약 현황">
            {contracts.slice(-6).reverse().map(c => {
              const cu = customers.find(x=>x.id===c.customer_id)||{}
              return <RecentItem key={c.id} icon="📝" iconBg="rgba(0,212,168,.15)" name={c.title||c.id} sub={cu.name}
                badge={<span style={{display:'inline-flex',padding:'1px 6px',borderRadius:10,fontSize:10,color:CONTRACT_COLOR[c.status]}}>{CONTRACT_STATUS[c.status]}</span>}
                amount={fmtW(c.amount||0)} onClick={()=>onNav('contract')} />
            })}
            {contracts.length===0&&<div style={{padding:20,color:'var(--muted)',textAlign:'center'}}>계약서가 없습니다</div>}
          </Box>
          <Box title="🧾 세금계산서">
            {taxes.slice(-4).reverse().map(t => {
              const c = customers.find(x=>x.id===t.customer_id)||{}
              return <RecentItem key={t.id} icon="🧾" iconBg="rgba(34,197,94,.15)" name={c.name} sub={t.id}
                badge={<span style={{display:'inline-flex',padding:'1px 6px',borderRadius:10,fontSize:10,background:t.status==='issued'?'rgba(34,197,94,.15)':'rgba(245,158,11,.15)',color:t.status==='issued'?'var(--success)':'var(--warn)'}}>{t.status==='issued'?'발행완료':'미발행'}</span>}
                amount={fmtW((t.supply||0)+(t.vat||0))} onClick={()=>onNav('tax')} />
            })}
            {taxes.length===0&&<div style={{padding:20,color:'var(--muted)',textAlign:'center'}}>데이터가 없습니다</div>}
          </Box>
        </div>
      </div>
    </div>
  ))
}
