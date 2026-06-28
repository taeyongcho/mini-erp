import { useState } from 'react'
import { Input, Btn, FormGroup } from '../components/UI'
import { api } from '../api'

export default function LoginPage({ onLogin }) {
  const [tab, setTab] = useState('login')
  const [login, setLogin] = useState({ email: '', password: '' })
  const [signup, setSignup] = useState({ company_name: '', name: '', email: '', password: '', biz_no: '' })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  function persist(data) {
    localStorage.setItem('erp_token', data.token)
    localStorage.setItem('erp_user', JSON.stringify(data.user))
    onLogin(data.user)
  }

  async function submitLogin(e) {
    e.preventDefault()
    setLoading(true); setErr('')
    try {
      const data = await api.login(login)
      persist(data)
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }

  async function submitSignup(e) {
    e.preventDefault()
    setLoading(true); setErr('')
    try {
      const data = await api.signup(signup)
      persist(data)
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }

  const switchTab = (t) => { setTab(t); setErr('') }

  const tabStyle = (active) => ({
    flex: 1, padding: '10px 0', textAlign: 'center', cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
    color: active ? 'var(--accent)' : 'var(--muted)',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid var(--border)',
    transition: 'all .15s'
  })

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg)'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 40, width: 380
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg,var(--accent),var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>E</div>
          <h2 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 700 }}>영업 ERP</h2>
        </div>

        <div style={{ display: 'flex', marginBottom: 24 }}>
          <div style={tabStyle(tab === 'login')} onClick={() => switchTab('login')}>로그인</div>
          <div style={tabStyle(tab === 'signup')} onClick={() => switchTab('signup')}>회원가입</div>
        </div>

        {tab === 'login' ? (
          <form onSubmit={submitLogin}>
            <div style={{ marginBottom: 16 }}>
              <FormGroup label="이메일">
                <Input type="email" value={login.email} onChange={v => setLogin(f => ({ ...f, email: v }))} placeholder="you@company.com" />
              </FormGroup>
            </div>
            <div style={{ marginBottom: 16 }}>
              <FormGroup label="비밀번호">
                <Input type="password" value={login.password} onChange={v => setLogin(f => ({ ...f, password: v }))} />
              </FormGroup>
            </div>
            {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
            <Btn variant="primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? '로그인 중...' : '로그인'}
            </Btn>
          </form>
        ) : (
          <form onSubmit={submitSignup}>
            <div style={{ marginBottom: 14 }}>
              <FormGroup label="업체명">
                <Input value={signup.company_name} onChange={v => setSignup(f => ({ ...f, company_name: v }))} placeholder="(주)회사명" />
              </FormGroup>
            </div>
            <div style={{ marginBottom: 14 }}>
              <FormGroup label="이름">
                <Input value={signup.name} onChange={v => setSignup(f => ({ ...f, name: v }))} placeholder="담당자 이름" />
              </FormGroup>
            </div>
            <div style={{ marginBottom: 14 }}>
              <FormGroup label="이메일">
                <Input type="email" value={signup.email} onChange={v => setSignup(f => ({ ...f, email: v }))} placeholder="you@company.com" />
              </FormGroup>
            </div>
            <div style={{ marginBottom: 14 }}>
              <FormGroup label="비밀번호">
                <Input type="password" value={signup.password} onChange={v => setSignup(f => ({ ...f, password: v }))} placeholder="6자 이상" />
              </FormGroup>
            </div>
            <div style={{ marginBottom: 16 }}>
              <FormGroup label="사업자번호 (선택)">
                <Input value={signup.biz_no} onChange={v => setSignup(f => ({ ...f, biz_no: v }))} placeholder="000-00-00000" />
              </FormGroup>
            </div>
            {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
            <Btn variant="primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? '가입 중...' : '회원가입'}
            </Btn>
          </form>
        )}

        <p style={{ marginTop: 18, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
          무료로 시작하세요
        </p>
      </div>
    </div>
  )
}
