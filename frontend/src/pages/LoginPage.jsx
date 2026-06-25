import { useState } from 'react'
import { Input, Btn, FormGroup } from '../components/UI'

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setErr('')
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || '로그인 실패')
      localStorage.setItem('erp_token', data.token)
      localStorage.setItem('erp_user', data.username)
      onLogin(data.username)
    } catch(e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', background:'var(--bg)'
    }}>
      <div style={{
        background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:12, padding:40, width:360
      }}>
        <h2 style={{textAlign:'center', marginBottom:32, color:'var(--text)'}}>
          영업 ERP
        </h2>
        <form onSubmit={submit}>
          <div style={{marginBottom:16}}>
            <FormGroup label="아이디">
              <Input
                value={form.username}
                onChange={v => setForm(f => ({...f, username: v}))}
              />
            </FormGroup>
          </div>
          <div style={{marginBottom:16}}>
            <FormGroup label="비밀번호">
              <Input
                type="password"
                value={form.password}
                onChange={v => setForm(f => ({...f, password: v}))}
              />
            </FormGroup>
          </div>
          {err && <p style={{color:'var(--danger)', fontSize:13, marginBottom:12}}>{err}</p>}
          <Btn variant="primary" type="submit" disabled={loading} style={{width:'100%'}}>
            {loading ? '로그인 중...' : '로그인'}
          </Btn>
        </form>
        <p style={{marginTop:16, fontSize:12, color:'var(--muted)', textAlign:'center'}}>
          기본 계정: admin / admin1234
        </p>
      </div>
    </div>
  )
}
