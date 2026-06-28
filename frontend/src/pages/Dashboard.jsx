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

// 선택한 기간의 [시작일, 종료일] 범위(YYYY-MM-DD)를 구한다.
// '전체'(all)는 선택한 연도(year) 1년 전체로 한정.
function periodRange(period, year) {
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
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: `${year}.01.01 ~ ${year}.12.31` }
}

function inRange(dateStr, range) {
  if (!range.start) return true
  if (!dateStr) return false
  const d = dateStr.slice(0, 10)
  return d >= range.start && d <= range.end
}

function inYear(dateStr, year) {
  return dateStr ? dateStr.slice(0, 4) === String(year) : false
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
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [period, setPeriod] = useState('all')
  const [yearOpen, setYearOpen] = useState(false)
  const { quotations, contracts, orders, taxes, customers, receivables = [], payables = [], accounts = [] } = data

  // 과거 연도는 일/주/월 상대기간이 의미 없으므로 '전체'(해당 연도)만
  const isCurrentYear = year === currentYear
  const activePeriod = isCurrentYear ? period : 'all'
  const visiblePeriods = isCurrentYear ? PERIODS : PERIODS.filter(p => p.key === 'all')

  // 선택 기간으로 필터링한 문서들
  const range = periodRange(activePeriod, year)
  const fQuotations = quotations.filter(q => inRange(q.date, range))
  const fContracts = contracts.filter(c => inRange(c.date, range))
  const fOrders = orders.filter(o => inRange(o.date, range))
  const fTaxes = taxes.filter(t => inRange(t.date, range))

  // 최근 목록은 선택 연도 기준으로 스코프
  const yQuotations = quotations.filter(q => inYear(q.date, year))
  const yOrders = orders.filter(o => inYear(o.date, year))
  const yContracts = contracts.filter(c => inYear(c.date, year))
  const yReceivables = receivables.filter(r => inYear(r.created_at || r.due_date, year))
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i)

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

  // 월별 손익 (선택 연도 12개월)
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
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

  const titleNode = (
    <div style={{ position:'relative', display:'inline-block' }}>
      <span onClick={() => setYearOpen(o => !o)} style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 }}>
        대시보드 <span style={{ fontSize:13, fontWeight:500, color:'var(--muted)' }}>({year}.01.01 ~ {year}.12.31) 해당 년도</span>
        <span style={{ fontSize:11, color:'var(--muted)' }}>▼</span>
      </span>
      {yearOpen && (
        <div style={{ position:'absolute', top:'100%', left:0, marginTop:6, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:4, zIndex:100, minWidth:120, boxShadow:'0 8px 24px rgba(0,0,0,.3)' }}>
          {yearOptions.map(y => (
            <div key={y} onClick={() => { setYear(y); setYearOpen(false) }}
              style={{ padding:'8px 14px', borderRadius:6, cursor:'pointer', fontSize:13, fontWeight: y===year?700:400,
                color: y===year?'var(--accent)':'var(--text)', background: y===year?'var(--surface2)':'transparent' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
              onMouseLeave={e=>e.currentTarget.style.background = y===year?'var(--surface2)':'transparent'}>
              {y}년
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return renderLayout(null, (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
        <div style={{ display:'flex', gap:4, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:4 }}>
          {visiblePeriods.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              style={{ padding:'6px 14px', borderRadius:6, border:'none', cursor:'pointer', fontFamily:'var(--sans)', fontSize:12, fontWeight:600,
                background: activePeriod===p.key ? 'var(--accent)' : 'transparent', color: activePeriod===p.key ? '#fff' : 'var(--label)' }}>
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

      <Box title={`📊 월별 손익 (${year}년)`}>
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
            {yQuotations.slice(-4).reverse().map(q => {
              const c = customers.find(x=>x.id===q.customer_id)||{}
              return <RecentItem key={q.id} icon="📋" iconBg="rgba(79,143,255,.15)" name={`${c.name} — ${q.id}`} sub={q.date}
                badge={<span style={{display:'inline-flex',padding:'1px 6px',borderRadius:10,fontSize:10,background:'rgba(79,143,255,.15)',color:'var(--accent)'}}>{({draft:'초안',sent:'발송',approved:'승인',rejected:'거절'})[q.status]}</span>}
                amount={fmtW(calcItems(q.items||[]).total)} onClick={()=>onNav('quotation')} />
            })}
            {yQuotations.length===0&&<div style={{padding:20,color:'var(--muted)',textAlign:'center'}}>견적서가 없습니다</div>}
          </Box>
          <Box title="📦 최근 발주서">
            {yOrders.slice(-3).reverse().map(o => {
              const c = customers.find(x=>x.id===o.customer_id)||{}
              return <RecentItem key={o.id} icon="📦" iconBg="rgba(245,158,11,.15)" name={`${c.name} — ${o.id}`} sub={o.date}
                badge={<span style={{display:'inline-flex',padding:'1px 6px',borderRadius:10,fontSize:10,background:'rgba(245,158,11,.15)',color:'var(--warn)'}}>{o.status==='ordered'?'발주':'완료'}</span>}
                amount={fmtW(calcItems(o.items||[]).total)} onClick={()=>onNav('order')} />
            })}
            {yOrders.length===0&&<div style={{padding:20,color:'var(--muted)',textAlign:'center'}}>발주서가 없습니다</div>}
          </Box>
        </div>
        <div>
          <Box title="💰 미수현황">
            {yReceivables.filter(r => r.status !== 'settled').slice(-6).reverse().map(r => (
              <RecentItem key={r.id} icon="💰" iconBg="rgba(245,158,11,.15)" name={r.customer_name||'-'} sub={`예정일 ${r.due_date||'-'}`}
                badge={<span style={{display:'inline-flex',padding:'1px 6px',borderRadius:10,fontSize:10,background:r.status==='partial'?'rgba(79,143,255,.15)':'rgba(245,158,11,.15)',color:r.status==='partial'?'var(--accent)':'var(--warn)'}}>{r.status==='partial'?'부분수금':'미수'}</span>}
                amount={fmtW(r.remaining||0)} onClick={()=>onNav('receivable')} />
            ))}
            {yReceivables.filter(r => r.status !== 'settled').length===0&&<div style={{padding:20,color:'var(--muted)',textAlign:'center'}}>미수 내역이 없습니다</div>}
          </Box>
          <Box title="📝 계약 현황">
            {yContracts.slice(-6).reverse().map(c => {
              const cu = customers.find(x=>x.id===c.customer_id)||{}
              return <RecentItem key={c.id} icon="📝" iconBg="rgba(0,212,168,.15)" name={c.title||c.id} sub={cu.name}
                badge={<span style={{display:'inline-flex',padding:'1px 6px',borderRadius:10,fontSize:10,color:CONTRACT_COLOR[c.status]}}>{CONTRACT_STATUS[c.status]}</span>}
                amount={fmtW(c.amount||0)} onClick={()=>onNav('contract')} />
            })}
            {yContracts.length===0&&<div style={{padding:20,color:'var(--muted)',textAlign:'center'}}>계약서가 없습니다</div>}
          </Box>
        </div>
      </div>
    </div>
  ), titleNode)
}
