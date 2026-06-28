import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import { Btn, Select, StatCard, TableWrap, Th, Td, toast } from '../components/UI'

export default function AdminPage({ user, onLogout }) {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCompanies(await api.getCompanies())
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function changePlan(id, plan) {
    setBusy(id)
    try {
      await api.setCompanyPlan(id, plan)
      setCompanies(cs => cs.map(c => c.id === id ? { ...c, plan } : c))
      toast('플랜이 변경되었습니다')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  async function toggleActive(id) {
    setBusy(id)
    try {
      const r = await api.toggleCompanyActive(id)
      setCompanies(cs => cs.map(c => c.id === id ? { ...c, active: r.active } : c))
      toast(r.active ? '활성화되었습니다' : '정지되었습니다')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const total = companies.length
  const proCount = companies.filter(c => c.plan === 'pro').length
  const freeCount = companies.filter(c => c.plan === 'free').length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--sans)', color: 'var(--text)' }}>
      <div style={{ height: 56, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,var(--accent),var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>E</div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>슈퍼어드민 콘솔</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{user?.name || user?.email}</span>
        <Btn variant="secondary" size="sm" onClick={onLogout}>로그아웃</Btn>
      </div>

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
          <StatCard label="총 업체수" value={total} />
          <StatCard label="PRO 업체" value={proCount} color="var(--accent2)" />
          <StatCard label="무료 업체" value={freeCount} color="var(--muted)" />
        </div>

        <TableWrap title="업체 목록" count={total}>
          <thead>
            <tr>
              <Th>업체명</Th>
              <Th>사업자번호</Th>
              <Th>플랜</Th>
              <Th right>사용자수</Th>
              <Th right>문서수</Th>
              <Th>가입일</Th>
              <Th>상태</Th>
              <Th>관리</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><Td>불러오는 중...</Td></tr>
            ) : companies.length === 0 ? (
              <tr><Td>등록된 업체가 없습니다</Td></tr>
            ) : companies.map(c => (
              <tr key={c.id}>
                <Td>{c.name}</Td>
                <Td mono>{c.biz_no || '-'}</Td>
                <Td>
                  <Select
                    value={c.plan}
                    onChange={v => changePlan(c.id, v)}
                    options={[{ value: 'free', label: '무료 (free)' }, { value: 'pro', label: 'PRO (pro)' }]}
                  />
                </Td>
                <Td right mono>{c.users}</Td>
                <Td right mono>{c.documents}</Td>
                <Td mono>{c.created_at}</Td>
                <Td>
                  <span style={{ color: c.active ? 'var(--success)' : 'var(--danger)', fontSize: 12, fontWeight: 600 }}>
                    {c.active ? '활성' : '정지'}
                  </span>
                </Td>
                <Td>
                  <Btn
                    variant={c.active ? 'danger' : 'success'}
                    size="sm"
                    disabled={busy === c.id}
                    onClick={() => toggleActive(c.id)}
                  >
                    {c.active ? '정지' : '활성화'}
                  </Btn>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>
    </div>
  )
}
