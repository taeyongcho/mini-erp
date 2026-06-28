from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import List, Optional, Any
from database import get_db
import models
from models import OrderStatus
from routers.auth import get_company_id, check_doc_limit
from routers.validators import check_date, check_items_amounts

router = APIRouter(prefix="/api/orders", tags=["orders"])


class OrderIn(BaseModel):
    id: str
    date: str
    deliver: str
    customer_id: int
    quotation_id: Optional[str] = None
    contract_id: Optional[str] = None
    status: OrderStatus = OrderStatus.ordered
    note: str = ""
    items: List[Any] = []

    @field_validator("date")
    @classmethod
    def date_valid(cls, v: str) -> str:
        return check_date(v, "수주일")

    @field_validator("deliver")
    @classmethod
    def deliver_valid(cls, v: str) -> str:
        return check_date(v, "납기일")

    @field_validator("items")
    @classmethod
    def items_valid(cls, v: list) -> list:
        return check_items_amounts(v)


@router.get("")
def list_orders(db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    rows = db.query(models.Order).filter_by(company_id=company_id).all()
    result = []
    for o in rows:
        d = {c.name: getattr(o, c.name) for c in o.__table__.columns}
        if d.get("status") and hasattr(d["status"], "value"):
            d["status"] = d["status"].value
        d["customer"] = {"id": o.customer.id, "name": o.customer.name} if o.customer else None
        result.append(d)
    return result


@router.post("")
def create_order(data: OrderIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    check_doc_limit(company_id, db)
    if db.query(models.Order).filter_by(id=data.id, company_id=company_id).first():
        raise HTTPException(400, "이미 존재하는 수주번호입니다")
    customer = db.query(models.Customer).filter_by(id=data.customer_id, company_id=company_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    o = models.Order(**data.dict(), company_id=company_id)
    db.add(o)
    db.commit()
    db.refresh(o)
    return o


@router.put("/{oid}")
def update_order(oid: str, data: OrderIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    o = db.query(models.Order).filter_by(id=oid, company_id=company_id).first()
    if not o:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    customer = db.query(models.Customer).filter_by(id=data.customer_id, company_id=company_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    prev_status = o.status.value if hasattr(o.status, 'value') else str(o.status)
    for k, v in data.dict().items():
        setattr(o, k, v)
    db.commit()
    db.refresh(o)
    # 미지급금 자동 생성 - completed로 변경될 때만
    new_status = data.status.value if hasattr(data.status, 'value') else str(data.status)
    if prev_status != "completed" and new_status == "completed":
        items = data.items or []
        supply = sum((it.get("qty", 0) or 0) * (it.get("price", 0) or 0) for it in items)
        vat = round(supply * 0.1)
        total = supply + vat
        if total > 0:
            existing = db.query(models.Payable).filter_by(order_id=oid, company_id=company_id).first()
            if not existing:
                due = str(date.today() + timedelta(days=30))
                pay = models.Payable(
                    order_id=oid,
                    customer_id=data.customer_id,
                    amount=total,
                    due_date=due,
                    status="pending",
                    settled_amount=0,
                    created_at=str(date.today()),
                    company_id=company_id,
                )
                db.add(pay)
                db.commit()
    return o


@router.delete("/{oid}")
def delete_order(oid: str, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    o = db.query(models.Order).filter_by(id=oid, company_id=company_id).first()
    if not o:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    # 세금계산서에서 참조 중인지 확인
    ref_tax = db.query(models.TaxInvoice).filter_by(order_id=oid, company_id=company_id).first()
    if ref_tax:
        raise HTTPException(400, "이 수주를 참조하는 세금계산서가 있습니다")
    db.delete(o)
    db.commit()
    return {"ok": True}


class SendIn(BaseModel):
    to: str
    subject: str = ""
    message: str = ""


@router.post("/{oid}/send")
def send_order(oid: str, body: SendIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    from routers.mailer import items_html, send_mail
    o = db.query(models.Order).filter_by(id=oid, company_id=company_id).first()
    if not o:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    company = db.query(models.Company).filter_by(id=company_id).first()
    customer = db.query(models.Customer).filter_by(id=o.customer_id, company_id=company_id).first()
    rows, supply = items_html(o.items)
    vat = round(supply * 0.1); total = supply + vat
    msg_html = f"<p style='white-space:pre-wrap'>{body.message}</p>" if body.message else ""
    html = f"""
    <div style="font-family:'Noto Sans KR',sans-serif;color:#222;max-width:680px">
      {msg_html}
      <h2 style="text-align:center">발주서</h2>
      <p style="text-align:center;color:#666">{o.id}</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:4px"><b>발주자</b> {company.name}</td>
            <td style="padding:4px"><b>공급업체</b> {customer.name if customer else ''}</td></tr>
        <tr><td style="padding:4px">발주일 {o.date}</td><td style="padding:4px">납기일 {o.deliver}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse" border="1" cellpadding="6">
        <thead style="background:#f5f5f5"><tr><th>#</th><th>품목명</th><th>수량</th><th>단가</th><th>금액</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
      <div style="text-align:right;margin-top:12px">
        <div>공급가액: {supply:,.0f}원</div><div>부가세: {vat:,.0f}원</div>
        <div style="font-size:16px;font-weight:700">합계: {total:,.0f}원</div>
      </div>
    </div>"""
    send_mail(company, body.to, body.subject or f"[{company.name}] 발주서 {o.id}", html)
    return {"ok": True}
