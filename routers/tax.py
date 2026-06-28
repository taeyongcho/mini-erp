from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import List, Optional, Any
from database import get_db
import models
from models import TaxStatus

router = APIRouter(prefix="/api/taxes", tags=["taxes"])


class TaxIn(BaseModel):
    id: str
    date: str
    customer_id: int
    order_id: Optional[str] = None
    status: TaxStatus = TaxStatus.pending
    note: str = ""
    items: List[Any] = []

    @field_validator("date")
    @classmethod
    def date_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("날짜는 필수입니다")
        return v.strip()


def calc_supply_vat(items: list) -> tuple[float, float]:
    """items 기반으로 supply, vat 계산"""
    supply = 0.0
    for item in items:
        qty = item.get("qty", 0) or item.get("quantity", 0) or 0
        price = item.get("price", 0) or 0
        supply += float(qty) * float(price)
    vat = round(supply * 0.1)
    return supply, vat


@router.get("")
def list_taxes(db: Session = Depends(get_db)):
    rows = db.query(models.TaxInvoice).all()
    result = []
    for t in rows:
        d = {c.name: getattr(t, c.name) for c in t.__table__.columns}
        if d.get("status") and hasattr(d["status"], "value"):
            d["status"] = d["status"].value
        d["customer"] = {"id": t.customer.id, "name": t.customer.name} if t.customer else None
        result.append(d)
    return result


@router.post("")
def create_tax(data: TaxIn, db: Session = Depends(get_db)):
    if db.query(models.TaxInvoice).filter_by(id=data.id).first():
        raise HTTPException(400, "이미 존재하는 계산서번호입니다")
    customer = db.query(models.Customer).filter_by(id=data.customer_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    supply, vat = calc_supply_vat(data.items)
    payload = data.dict()
    payload["supply"] = supply
    payload["vat"] = vat
    t = models.TaxInvoice(**payload)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.put("/{tid}")
def update_tax(tid: str, data: TaxIn, db: Session = Depends(get_db)):
    t = db.query(models.TaxInvoice).filter_by(id=tid).first()
    if not t:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    customer = db.query(models.Customer).filter_by(id=data.customer_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    supply, vat = calc_supply_vat(data.items)
    payload = data.dict()
    payload["supply"] = supply
    payload["vat"] = vat
    for k, v in payload.items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return t


@router.patch("/{tid}/issue")
def issue_tax(tid: str, db: Session = Depends(get_db)):
    t = db.query(models.TaxInvoice).filter_by(id=tid).first()
    if not t:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    t.status = TaxStatus.issued
    db.commit()
    db.refresh(t)
    # 미수금 자동 생성
    total = (t.supply or 0) + (t.vat or 0)
    if total > 0:
        existing = db.query(models.Receivable).filter_by(tax_invoice_id=tid).first()
        if not existing:
            due = str(date.today() + timedelta(days=30))
            rec = models.Receivable(
                tax_invoice_id=tid,
                customer_id=t.customer_id,
                amount=total,
                due_date=due,
                status="pending",
                settled_amount=0,
                created_at=str(date.today()),
            )
            db.add(rec)
            db.commit()
    return t


@router.delete("/{tid}")
def delete_tax(tid: str, db: Session = Depends(get_db)):
    t = db.query(models.TaxInvoice).filter_by(id=tid).first()
    if not t:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    db.delete(t)
    db.commit()
    return {"ok": True}
