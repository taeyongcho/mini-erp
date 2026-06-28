from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator, model_validator, Field
from typing import List, Optional, Any
from database import get_db
import models
from models import ContractStatus
from routers.auth import get_company_id, check_doc_limit
from routers.validators import check_date, valid_date, check_items_amounts

router = APIRouter(prefix="/api/contracts", tags=["contracts"])


class ContractIn(BaseModel):
    id: str
    date: str
    start_date: str
    end_date: str
    customer_id: int
    quotation_id: Optional[str] = None
    status: ContractStatus = ContractStatus.reviewing
    title: str
    amount: float = Field(default=0, ge=0)
    payment_terms: str = ""
    delivery_terms: str = ""
    warranty: str = ""
    special_terms: str = ""
    items: List[Any] = []
    note: str = ""

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("계약명은 필수입니다")
        return v.strip()

    @field_validator("date")
    @classmethod
    def date_valid(cls, v: str) -> str:
        return check_date(v, "계약일")

    @field_validator("start_date")
    @classmethod
    def start_valid(cls, v: str) -> str:
        return check_date(v, "시작일")

    @field_validator("end_date")
    @classmethod
    def end_valid(cls, v: str) -> str:
        return check_date(v, "종료일")

    @field_validator("items")
    @classmethod
    def items_valid(cls, v: list) -> list:
        return check_items_amounts(v)

    @model_validator(mode="after")
    def end_after_start(self):
        if valid_date(self.start_date) and valid_date(self.end_date) and self.end_date < self.start_date:
            raise ValueError("계약 종료일은 시작일 이후여야 합니다")
        return self


def serialize(c):
    d = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    # Enum -> str
    if d.get("status") and hasattr(d["status"], "value"):
        d["status"] = d["status"].value
    d["customer"] = {"id": c.customer.id, "name": c.customer.name} if c.customer else None
    from datetime import date
    try:
        delta = (date.fromisoformat(c.end_date) - date.today()).days
        d["days_left"] = delta
    except Exception:
        d["days_left"] = None
    return d


@router.get("")
def list_contracts(db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    return [serialize(c) for c in db.query(models.Contract).filter_by(company_id=company_id).all()]


@router.get("/{cid}")
def get_contract(cid: str, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    c = db.query(models.Contract).filter_by(id=cid, company_id=company_id).first()
    if not c:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    return serialize(c)


@router.post("")
def create_contract(data: ContractIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    check_doc_limit(company_id, db)
    if db.query(models.Contract).filter_by(id=data.id, company_id=company_id).first():
        raise HTTPException(400, "이미 존재하는 계약번호입니다")
    customer = db.query(models.Customer).filter_by(id=data.customer_id, company_id=company_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    c = models.Contract(**data.dict(), company_id=company_id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return serialize(c)


@router.put("/{cid}")
def update_contract(cid: str, data: ContractIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    c = db.query(models.Contract).filter_by(id=cid, company_id=company_id).first()
    if not c:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    customer = db.query(models.Customer).filter_by(id=data.customer_id, company_id=company_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    for k, v in data.dict().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return serialize(c)


@router.patch("/{cid}/status")
def update_status(cid: str, payload: dict, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    c = db.query(models.Contract).filter_by(id=cid, company_id=company_id).first()
    if not c:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    new_status = payload.get("status")
    if new_status:
        try:
            c.status = ContractStatus(new_status)
        except ValueError:
            raise HTTPException(400, f"유효하지 않은 상태값입니다: {new_status}")
    db.commit()
    db.refresh(c)
    return serialize(c)


@router.delete("/{cid}")
def delete_contract(cid: str, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    c = db.query(models.Contract).filter_by(id=cid, company_id=company_id).first()
    if not c:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    # 수주에서 참조 중인지 확인
    ref_order = db.query(models.Order).filter_by(contract_id=cid, company_id=company_id).first()
    if ref_order:
        raise HTTPException(400, "이 계약을 참조하는 수주가 있습니다")
    db.delete(c)
    db.commit()
    return {"ok": True}


class SendIn(BaseModel):
    to: str
    subject: str = ""
    message: str = ""


@router.post("/{cid}/send")
def send_contract(cid: str, body: SendIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    c = db.query(models.Contract).filter_by(id=cid, company_id=company_id).first()
    if not c:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    company = db.query(models.Company).filter_by(id=company_id).first()
    if not (company and company.smtp_host and company.smtp_pass and company.smtp_user):
        raise HTTPException(400, "내 정보에서 SMTP(메일) 설정을 먼저 완료하세요")
    if not body.to or "@" not in body.to:
        raise HTTPException(400, "받는사람 이메일을 올바르게 입력하세요")

    customer = db.query(models.Customer).filter_by(id=c.customer_id, company_id=company_id).first()
    rows = ""
    supply = 0
    for i, it in enumerate(c.items or [], 1):
        qty = it.get("qty", 0) or 0; price = it.get("price", 0) or 0; amt = qty * price; supply += amt
        rows += (f"<tr><td>{i}</td><td>{it.get('name','')}</td><td style='text-align:right'>{qty:,}</td>"
                 f"<td style='text-align:right'>{price:,.0f}</td><td style='text-align:right'>{amt:,.0f}</td></tr>")
    vat = round(supply * 0.1); total = supply + vat
    terms = ""
    for k, v in [("결제 조건", c.payment_terms), ("납품 조건", c.delivery_terms), ("하자보증", c.warranty), ("특약사항", c.special_terms)]:
        if v:
            terms += f"<p><b>{k}</b><br>{v}</p>"
    msg_html = f"<p style='white-space:pre-wrap'>{body.message}</p>" if body.message else ""
    html = f"""
    <div style="font-family:'Noto Sans KR',sans-serif;color:#222;max-width:680px">
      {msg_html}
      <h2 style="text-align:center">계약서</h2>
      <p style="text-align:center;color:#666">{c.id} · {c.title or ''}</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:4px"><b>공급자</b> {company.name}</td>
            <td style="padding:4px"><b>공급받는자</b> {customer.name if customer else ''}</td></tr>
        <tr><td style="padding:4px">계약일 {c.date}</td>
            <td style="padding:4px">계약기간 {c.start_date} ~ {c.end_date}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse" border="1" cellpadding="6">
        <thead style="background:#f5f5f5"><tr><th>#</th><th>품목명</th><th>수량</th><th>단가</th><th>금액</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
      <div style="text-align:right;margin-top:12px">
        <div>공급가액: {supply:,.0f}원</div><div>부가세: {vat:,.0f}원</div>
        <div style="font-size:16px;font-weight:700">계약금액: {total:,.0f}원</div>
      </div>
      {terms}
    </div>"""

    sender = company.smtp_from or company.smtp_user
    msg = MIMEMultipart("alternative")
    msg["Subject"] = body.subject or f"[{company.name}] 계약서 {c.id}"
    msg["From"] = sender
    msg["To"] = body.to
    msg.attach(MIMEText(html, "html", "utf-8"))
    try:
        if company.smtp_tls:
            server = smtplib.SMTP(company.smtp_host, company.smtp_port or 587, timeout=20)
            server.ehlo(); server.starttls(); server.ehlo()
        else:
            server = smtplib.SMTP_SSL(company.smtp_host, company.smtp_port or 465, timeout=20)
        server.login(company.smtp_user, company.smtp_pass)
        server.sendmail(sender, [body.to], msg.as_string())
        server.quit()
    except Exception as e:
        raise HTTPException(500, f"메일 발송 실패: {e}")
    return {"ok": True}
