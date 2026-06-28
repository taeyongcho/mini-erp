import { useState } from 'react'
import { api } from '../api'
import { FormGrid, FormGroup, Input, Select, Btn, toast } from '../components/UI.jsx'
import { isBizNo } from '../utils/index.js'

export default function ProfilePage({ renderLayout, user, onUserUpdate }) {
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    company_name: user?.company || '',
    biz_no: user?.biz_no || '',
    quote_format: user?.quote_format || 'Q-{YYYY}-{seq}',
    contract_format: user?.contract_format || 'CT-{YYYY}-{seq}',
    smtp_host: user?.smtp_host || '',
    smtp_port: user?.smtp_port || 587,
    smtp_user: user?.smtp_user || '',
    smtp_from: user?.smtp_from || '',
    smtp_tls: user?.smtp_tls ?? true,
    smtp_pass: '',
  })
  const smtpConfigured = !!user?.smtp_configured
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  async function saveProfile() {
    if (!profile.company_name.trim()) return toast('업체명을 입력하세요', 'error')
    if (!profile.email.trim()) return toast('이메일을 입력하세요', 'error')
    if (!isBizNo(profile.biz_no)) return toast('사업자번호 형식이 올바르지 않습니다 (000-00-00000)', 'error')
    setSavingProfile(true)
    try {
      const res = await api.updateProfile(profile)
      // 새 토큰 + 갱신된 user 정보 저장
      if (res.token) localStorage.setItem('erp_token', res.token)
      const merged = { ...user, ...res.user, biz_no: profile.biz_no, quote_format: profile.quote_format, contract_format: profile.contract_format }
      localStorage.setItem('erp_user', JSON.stringify(merged))
      onUserUpdate && onUserUpdate(merged)
      toast('내 정보가 변경되었습니다')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword() {
    if (!pw.current_password) return toast('현재 비밀번호를 입력하세요', 'error')
    if (pw.new_password.length < 6) return toast('새 비밀번호는 6자 이상이어야 합니다', 'error')
    if (pw.new_password !== pw.confirm) return toast('새 비밀번호 확인이 일치하지 않습니다', 'error')
    setSavingPw(true)
    try {
      await api.changePassword({ current_password: pw.current_password, new_password: pw.new_password })
      setPw({ current_password: '', new_password: '', confirm: '' })
      toast('비밀번호가 변경되었습니다')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSavingPw(false)
    }
  }

  const card = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, padding: 24, maxWidth: 680, marginBottom: 20,
  }
  const cardTitle = { fontSize: 14, fontWeight: 700, marginBottom: 4 }
  const cardDesc = { fontSize: 12, color: 'var(--muted)', marginBottom: 20 }

  const content = (
    <div>
      <div style={card}>
        <div style={cardTitle}>본인 정보</div>
        <div style={cardDesc}>업체명, 담당자명, 이메일, 사업자번호를 변경할 수 있습니다.</div>
        <FormGrid>
          <FormGroup label="업체명">
            <Input value={profile.company_name} onChange={v => setProfile(p => ({ ...p, company_name: v }))} />
          </FormGroup>
          <FormGroup label="담당자명">
            <Input value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} />
          </FormGroup>
          <FormGroup label="이메일 (로그인 아이디)">
            <Input type="email" value={profile.email} onChange={v => setProfile(p => ({ ...p, email: v }))} />
          </FormGroup>
          <FormGroup label="사업자번호">
            <Input value={profile.biz_no} onChange={v => setProfile(p => ({ ...p, biz_no: v }))} />
          </FormGroup>
          <FormGroup label="견적번호 형식">
            <Input value={profile.quote_format} onChange={v => setProfile(p => ({ ...p, quote_format: v }))} placeholder="Q-{YYYY}-{seq}" mono />
          </FormGroup>
          <FormGroup label="계약번호 형식">
            <Input value={profile.contract_format} onChange={v => setProfile(p => ({ ...p, contract_format: v }))} placeholder="CT-{YYYY}-{seq}" mono />
          </FormGroup>
          <FormGroup label="" full>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              사용 가능: {'{YYYY}'} 연도4자리 · {'{YY}'} 연도2자리 · {'{MM}'} 월 · {'{seq}'} 일련번호 (예: CT-{'{YYYY}'}-{'{seq}'} → CT-{new Date().getFullYear()}-001)
            </div>
          </FormGroup>
        </FormGrid>
        <div style={{ marginTop: 20 }}>
          <Btn variant="primary" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? '저장 중...' : '정보 저장'}
          </Btn>
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>메일(SMTP) 설정 {smtpConfigured && <span style={{fontSize:11,color:'var(--success)'}}>● 설정됨</span>}</div>
        <div style={cardDesc}>견적서 "발송" 시 이 계정으로 고객에게 메일이 전송됩니다. Gmail/네이버는 <b>앱 비밀번호</b>를 발급받아 입력하세요.</div>
        <FormGrid>
          <FormGroup label="SMTP 서버">
            <Input value={profile.smtp_host} onChange={v => setProfile(p => ({ ...p, smtp_host: v }))} placeholder="smtp.gmail.com" />
          </FormGroup>
          <FormGroup label="포트 / 보안">
            <div style={{ display:'flex', gap:8 }}>
              <Input value={profile.smtp_port} onChange={v => setProfile(p => ({ ...p, smtp_port: +v || 587 }))} placeholder="587" style={{ width:90 }} />
              <Select value={profile.smtp_tls ? 'tls' : 'ssl'} onChange={v => setProfile(p => ({ ...p, smtp_tls: v === 'tls', smtp_port: v === 'tls' ? 587 : 465 }))}
                options={[{ value:'tls', label:'STARTTLS (587)' }, { value:'ssl', label:'SSL (465)' }]} />
            </div>
          </FormGroup>
          <FormGroup label="아이디 (메일주소)">
            <Input type="email" value={profile.smtp_user} onChange={v => setProfile(p => ({ ...p, smtp_user: v }))} placeholder="me@gmail.com" />
          </FormGroup>
          <FormGroup label="앱 비밀번호">
            <Input type="password" value={profile.smtp_pass} onChange={v => setProfile(p => ({ ...p, smtp_pass: v }))} placeholder={smtpConfigured ? '변경 시에만 입력' : '앱 비밀번호'} />
          </FormGroup>
          <FormGroup label="보내는사람 표시 (선택)" full>
            <Input value={profile.smtp_from} onChange={v => setProfile(p => ({ ...p, smtp_from: v }))} placeholder="비우면 아이디로 발송됩니다" />
          </FormGroup>
        </FormGrid>
        <div style={{ marginTop: 20 }}>
          <Btn variant="primary" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? '저장 중...' : '설정 저장'}
          </Btn>
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>비밀번호 변경</div>
        <div style={cardDesc}>보안을 위해 현재 비밀번호 확인 후 변경됩니다. (6자 이상)</div>
        <FormGrid cols={1}>
          <FormGroup label="현재 비밀번호">
            <Input type="password" value={pw.current_password} onChange={v => setPw(p => ({ ...p, current_password: v }))} />
          </FormGroup>
          <FormGroup label="새 비밀번호">
            <Input type="password" value={pw.new_password} onChange={v => setPw(p => ({ ...p, new_password: v }))} />
          </FormGroup>
          <FormGroup label="새 비밀번호 확인">
            <Input type="password" value={pw.confirm} onChange={v => setPw(p => ({ ...p, confirm: v }))} />
          </FormGroup>
        </FormGrid>
        <div style={{ marginTop: 20 }}>
          <Btn variant="primary" onClick={savePassword} disabled={savingPw}>
            {savingPw ? '변경 중...' : '비밀번호 변경'}
          </Btn>
        </div>
      </div>
    </div>
  )

  return renderLayout(null, content)
}
