export const QUOTATION_STATUSES = [
  { value: 'draft', label: '초안' },
  { value: 'sent', label: '발송됨' },
  { value: 'approved', label: '승인' },
  { value: 'rejected', label: '반려' },
]

export const CONTRACT_STATUSES = [
  { value: 'reviewing', label: '검토중' },
  { value: 'waiting_sign', label: '서명대기' },
  { value: 'active', label: '계약중' },
  { value: 'renewing', label: '갱신예정' },
  { value: 'expired', label: '만료' },
  { value: 'terminated', label: '해지' },
]

export const ORDER_STATUSES = [
  { value: 'ordered', label: '발주' },
  { value: 'completed', label: '완료' },
]

export const TAX_STATUSES = [
  { value: 'pending', label: '미발행' },
  { value: 'issued', label: '발행완료' },
]

export const CUSTOMER_TYPES = ['법인', '개인', '공공기관', '기타']
