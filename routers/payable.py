from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
import models
from routers.auth import get_company_id

router = APIRouter(prefix="/api/payables", tags=["payables"])


class PayableIn(BaseModel):
    customer_id: int
    amount: float
    due_date: str
    order_id: Optional[str] = None
    note: str = ""


class SettleIn(BaseModel):
    settled_amount: float
    settled_date: str
    note: str = ""


def row_to_dict(r, db, company_id):
    d = {c.name: getattr(r, c.name) for c in r.__table__.columns}
    customer = db.query(models.Customer).filter_by(id=r.customer_id, company_id=company_id).first()
    d["customer_name"] = customer.name if customer else ""
    d["remaining"] = (d["amount"] or 0) - (d["settled_amount"] or 0)
    return d


@router.get("")
def list_payables(db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    rows = db.query(models.Payable).filter_by(company_id=company_id).all()
    return [row_to_dict(r, db, company_id) for r in rows]


@router.post("")
def create_payable(data: PayableIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    customer = db.query(models.Customer).filter_by(id=data.customer_id, company_id=company_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    p = models.Payable(
        customer_id=data.customer_id,
        amount=data.amount,
        due_date=data.due_date,
        order_id=data.order_id,
        note=data.note,
        status="pending",
        settled_amount=0,
        created_at=str(date.today()),
        company_id=company_id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return row_to_dict(p, db, company_id)


@router.put("/{pid}")
def update_payable(pid: int, data: PayableIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    p = db.query(models.Payable).filter_by(id=pid, company_id=company_id).first()
    if not p:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    for k, v in data.dict().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return row_to_dict(p, db, company_id)


@router.patch("/{pid}/settle")
def settle_payable(pid: int, data: SettleIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    p = db.query(models.Payable).filter_by(id=pid, company_id=company_id).first()
    if not p:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    p.settled_amount = data.settled_amount
    p.settled_date = data.settled_date
    if data.note:
        p.note = data.note
    p.status = "settled" if data.settled_amount >= p.amount else "partial"
    db.commit()
    db.refresh(p)
    return row_to_dict(p, db, company_id)


@router.delete("/{pid}")
def delete_payable(pid: int, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    p = db.query(models.Payable).filter_by(id=pid, company_id=company_id).first()
    if not p:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    db.delete(p)
    db.commit()
    return {"ok": True}
