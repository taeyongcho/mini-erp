from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator, model_validator
from typing import List, Optional, Any
from database import get_db
import models
from models import QuotationStatus
from routers.auth import get_company_id, check_doc_limit
from routers.validators import check_date, valid_date, check_items_amounts

router = APIRouter(prefix="/api/quotations", tags=["quotations"])


class QuotationIn(BaseModel):
    id: str
    date: str
    expire: str
    customer_id: int
    status: QuotationStatus = QuotationStatus.draft
    note: str = ""
    items: List[Any] = []

    @field_validator("id")
    @classmethod
    def id_format(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("견적번호를 입력하세요")
        return v

    @field_validator("date")
    @classmethod
    def date_valid(cls, v: str) -> str:
        return check_date(v, "견적일")

    @field_validator("expire")
    @classmethod
    def expire_valid(cls, v: str) -> str:
        return check_date(v, "유효기한")

    @field_validator("items")
    @classmethod
    def items_valid(cls, v: list) -> list:
        return check_items_amounts(v)

    @model_validator(mode="after")
    def expire_after_date(self):
        if valid_date(self.date) and valid_date(self.expire) and self.expire < self.date:
            raise ValueError("유효기한은 견적일 이후여야 합니다")
        return self


@router.get("")
def list_quotations(db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    rows = db.query(models.Quotation).filter_by(company_id=company_id).all()
    result = []
    for q in rows:
        d = {c.name: getattr(q, c.name) for c in q.__table__.columns}
        # Enum -> str 직렬화
        if d.get("status") and hasattr(d["status"], "value"):
            d["status"] = d["status"].value
        d["customer"] = {"id": q.customer.id, "name": q.customer.name} if q.customer else None
        result.append(d)
    return result


@router.post("")
def create_quotation(data: QuotationIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    check_doc_limit(company_id, db)
    if db.query(models.Quotation).filter_by(id=data.id, company_id=company_id).first():
        raise HTTPException(400, "이미 존재하는 견적번호입니다")
    customer = db.query(models.Customer).filter_by(id=data.customer_id, company_id=company_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    q = models.Quotation(**data.dict(), company_id=company_id)
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


@router.put("/{qid}")
def update_quotation(qid: str, data: QuotationIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    q = db.query(models.Quotation).filter_by(id=qid, company_id=company_id).first()
    if not q:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    customer = db.query(models.Customer).filter_by(id=data.customer_id, company_id=company_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    for k, v in data.dict().items():
        setattr(q, k, v)
    db.commit()
    db.refresh(q)
    return q


@router.delete("/{qid}")
def delete_quotation(qid: str, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    q = db.query(models.Quotation).filter_by(id=qid, company_id=company_id).first()
    if not q:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    db.delete(q)
    db.commit()
    return {"ok": True}


class SendIn(BaseModel):
    to: str
    subject: str = ""
    message: str = ""


def _quotation_html(q, company, customer, message):
    rows = ""
    supply = 0
    for i, it in enumerate(q.items or [], 1):
        qty = it.get("qty", 0) or 0
        price = it.get("price", 0) or 0
        amt = qty * price
        supply += amt
        rows += (f"<tr><td>{i}</td><td>{it.get('name','')}</td>"
                 f"<td style='text-align:right'>{qty:,}</td>"
                 f"<td style='text-align:right'>{price:,.0f}</td>"
                 f"<td style='text-align:right'>{amt:,.0f}</td></tr>")
    vat = round(supply * 0.1)
    total = supply + vat
    msg_html = f"<p style='white-space:pre-wrap'>{message}</p>" if message else ""
    return f"""
    <div style="font-family:'Noto Sans KR',sans-serif;color:#222;max-width:680px">
      {msg_html}
      <h2 style="text-align:center">견적서</h2>
      <p style="text-align:center;color:#666">{q.id}</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:4px"><b>공급자</b> {company.name}</td>
            <td style="padding:4px"><b>공급받는자</b> {customer.name if customer else ''}</td></tr>
        <tr><td style="padding:4px">견적일 {q.date}</td>
            <td style="padding:4px">유효기간 {q.expire}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse" border="1" cellpadding="6">
        <thead style="background:#f5f5f5">
          <tr><th>#</th><th>품목명</th><th>수량</th><th>단가</th><th>금액</th></tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      <div style="text-align:right;margin-top:12px">
        <div>공급가액: {supply:,.0f}원</div>
        <div>부가세: {vat:,.0f}원</div>
        <div style="font-size:16px;font-weight:700">합계: {total:,.0f}원</div>
      </div>
    </div>"""


@router.post("/{qid}/send")
def send_quotation(qid: str, body: SendIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    q = db.query(models.Quotation).filter_by(id=qid, company_id=company_id).first()
    if not q:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    company = db.query(models.Company).filter_by(id=company_id).first()
    if not (company and company.smtp_host and company.smtp_pass and company.smtp_user):
        raise HTTPException(400, "내 정보에서 SMTP(메일) 설정을 먼저 완료하세요")
    if not body.to or "@" not in body.to:
        raise HTTPException(400, "받는사람 이메일을 올바르게 입력하세요")

    customer = db.query(models.Customer).filter_by(id=q.customer_id, company_id=company_id).first()
    sender = company.smtp_from or company.smtp_user
    subject = body.subject or f"[{company.name}] 견적서 {q.id}"
    html = _quotation_html(q, company, customer, body.message)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
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

    q.status = "sent"
    db.commit()
    return {"ok": True}
