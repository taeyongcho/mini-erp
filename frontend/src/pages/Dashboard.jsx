import { useState } from 'react'
import { StatCard, Badge, fmtW } from '../components/UI.jsx'
import { useData } from '../context/DataContext.jsx'
import { calcItems } from '../utils/index.js'

const CONTRACT_STATUS = { reviewing:'검토중', waiting_sign:'서명대기', active:'계약중', renewing:'갱신예정', expired:'만료', terminated:'해지' }
const CONTRACT_COLOR = { reviewing:'var(--muted)', waiting_sign:'var(--accent)', active:'var(--success)', renewing:'var(--accent2)', expired:'var(--warn)', terminated:'var(--danger)' }

function monthKey(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : ''
}

const PERIODS = [
  { key: 'day', label: '일일현황' },
  { key: 'week', label: '주간현황' },
  { key: 'month', label: '월별현황' },
  { key: 'all', label: '전체' },
]

// 선택한 기간의 [시작일, 종료일] 범위(YYYY-MM-DD)를 구한다. all이면 null.
function periodRange(period) {
  const now = new Date()
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (period === 'day') {
    const s = ymd(now)
    return { start: s, end: s, label: `${s}` }
  }
  if (period === 'week') {
    const dow = (now.getDay() + 6) % 7 // 월요일=0
    const mon = new Date(now); mon.setDate(now.getDate() - dow)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { start: ymd(mon), end: ymd(sun), label: `${ymd(mon)} ~ ${ymd(sun)}` }
  }
  if (period === 'month') {
    const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return { start: m + '-01', end: m + '-31', label: `${m}` }
  }
  return { start: null, end: null, label: '전체 기간' }
}

function inRange(dateStr, range) {
  if (!range.start) return true
  if (!dateStr) return false
  const d = dateStr.slice(0, 10)
  return d >= range.start && d <= range.end
}

function last6Months() {
  const months = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

export default function Dashboard({ onNav, renderLayout }) {
  const { data } = useData()
  const [period, setPeriod] = useState('month')
  const { quotations, contracts, orders, taxes, customers, receivables = [], payables = [], accounts = [] } = data

  // 선택 기간으로 필터링한 문서들
  const range = periodRange(period)
  const fQuotations = quotations.filter(q => inRange(q.date, range))
  const fContracts = contracts.filter(c => inRange(c.date, range))
  const fOrders = orders.filter(o => inRange(o.date, range))
  const fTaxes = taxes.filter(t => inRange(t.date, range))

  const totalQ = fQuotations.reduce((s,q)=>s+calcItems(q.items||[]).total,0)
  const totalC = fContracts.reduce((s,c)=>s+(c.amount||0),0)
  const totalO = fOrders.reduce((s,o)=>s+calcItems(o.items||[]).total,0)
  const totalT = fTaxes.reduce((s,t)=>s+(t.supply||0)+(t.vat||0),0)
  const pendingTax = fTaxes.filter(t=>t.status==='pending').length
  const waitingSign = fContracts.filter(c=>c.status==='waiting_sign').length
  const expiringSoon = contracts.filter(c=>c.status==='active'&&c.days_left!==null&&c.days_left>=0&&c.days_left<=30).length

  // 자금현황
  const totalReceivable = receivables.filter(r => r.status !== 'settled').reduce((s, r) => s + (r.remaining || 0), 0)
  const totalPayable = payables.filter(p => p.status !== 'settled').reduce((s, p) => s + (p.remaining || 0), 0)
  const totalAccountBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0)
  const netFund = totalAccountBalance + totalReceivable - totalPayable

  // 월별 손익
  const months = last6Months()
  const monthlyData = months.map(m => {
    const sales = taxes.filter(t => t.status === 'issued' && monthKey(t.date) === m)
      .reduce((s, t) => s + (t.supply || 0) + (t.vat || 0), 0)
    const purchase = orders.filter(o => o.status === 'completed' && monthKey(o.date) === m)
      .reduce((s, o) => s + calcItems(o.items || []).total, 0)
    const profit = sales - purchase
    const rate = sales > 0 ? (profit / sales * 100).toFixed(1) : '-'
    return { month: m, sales, purchase, profit, rate }
  })

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
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
        <div style={{ display:'flex', gap:4, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:4 }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              style={{ padding:'6px 14px', borderRadius:6, border:'none', cursor:'pointer', fontFamily:'var(--sans)', fontSize:12, fontWeight:600,
                background: period===p.key ? 'var(--accent)' : 'transparent', color: period===p.key ? '#fff' : 'var(--label)' }}>
              {p.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize:12, color:'var(--muted)', fontFamily:'var(--mono)' }}>📅 {range.label}</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:16 }}>
        <StatCard label="견적 총액" value={fmtW(totalQ)} sub={`${fQuotations.length}건`} color="var(--accent)" />
        <StatCard label="계약 총액" value={fmtW(totalC)} sub={`서명대기 ${waitingSign}건`} color="var(--accent2)" />
        <StatCard label="발주 총액" value={fmtW(totalO)} sub={`${fOrders.length}건`} color="var(--warn)" />
        <StatCard label="세금계산서" value={fmtW(totalT)} sub={`미발행 ${pendingTax}건`} color="var(--success)" />
      </div>

      <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.8px', margin:'4px 2px 10px' }}>자금현황 (현재 시점)</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:16 }}>
        <StatCard label="받을돈" value={fmtW(totalReceivable)} sub="미수 잔액" color="var(--warn)" />
        <StatCard label="줄돈" value={fmtW(totalPayable)} sub="미지급 잔액" color="var(--danger)" />
        <StatCard label="계좌잔액" value={fmtW(totalAccountBalance)} sub={`${accounts.length}개 계좌`} color="var(--accent2)" />
        <StatCard label="순자금" value={fmtW(netFund)} sub="계좌+받을돈-줄돈" color={netFund >= 0 ? 'var(--success)' : 'var(--danger)'} />
      </div>

      {expiringSoon > 0 && (
        <div style={{ background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.3)', borderRadius:8, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <span>⚠️</span>
          <span style={{ fontSize:12, color:'var(--warn)' }}>만료 30일 이내 계약 <strong>{expiringSoon}건</strong>이 있습니다</span>
          <button onClick={()=>onNav('contract')} style={{ marginLeft:'auto', background:'none', border:'1px solid var(--warn)', color:'var(--warn)', borderRadius:6, padding:'4px 12px', fontSize:11, cursor:'pointer', fontFamily:'var(--sans)' }}>확인하기</button>
        </div>
      )}

      <Box title="📊 월별 손익 (최근 6개월)">
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['월','매출','매입','수익','이익률'].map(h => (
                  <th key={h} style={{ padding:'10px 16px', textAlign: h==='월'?'left':'right', fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.7px', borderBottom:'1px solid var(--border)', background:'var(--surface2)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map(m => (
                <tr key={m.month} style={{ borderBottom:'1px solid rgba(42,48,80,.3)' }}>
                  <td style={{ padding:'10px 16px', fontSize:12 }}>{m.month}</td>
                  <td style={{ padding:'10px 16px', textAlign:'right', fontFamily:'var(--mono)', fontSize:12, color:'var(--accent)' }}>{fmtW(m.sales)}</td>
                  <td style={{ padding:'10px 16px', textAlign:'right', fontFamily:'var(--mono)', fontSize:12, color:'var(--warn)' }}>{fmtW(m.purchase)}</td>
                  <td style={{ padding:'10px 16px', textAlign:'right', fontFamily:'var(--mono)', fontSize:12, color: m.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtW(m.profit)}</td>
                  <td style={{ padding:'10px 16px', textAlign:'right', fontSize:12, color:'var(--muted)' }}>{m.rate !== '-' ? `${m.rate}%` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>

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
