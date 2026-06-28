from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
import models
from routers.auth import get_company_id

router = APIRouter(prefix="/api/receivables", tags=["receivables"])


class ReceivableIn(BaseModel):
    customer_id: int
    amount: float
    due_date: str
    tax_invoice_id: Optional[str] = None
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
def list_receivables(db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    rows = db.query(models.Receivable).filter_by(company_id=company_id).all()
    return [row_to_dict(r, db, company_id) for r in rows]


@router.post("")
def create_receivable(data: ReceivableIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    customer = db.query(models.Customer).filter_by(id=data.customer_id, company_id=company_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    r = models.Receivable(
        customer_id=data.customer_id,
        amount=data.amount,
        due_date=data.due_date,
        tax_invoice_id=data.tax_invoice_id,
        note=data.note,
        status="pending",
        settled_amount=0,
        created_at=str(date.today()),
        company_id=company_id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return row_to_dict(r, db, company_id)


@router.put("/{rid}")
def update_receivable(rid: int, data: ReceivableIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    r = db.query(models.Receivable).filter_by(id=rid, company_id=company_id).first()
    if not r:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    for k, v in data.dict().items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return row_to_dict(r, db, company_id)


@router.patch("/{rid}/settle")
def settle_receivable(rid: int, data: SettleIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    r = db.query(models.Receivable).filter_by(id=rid, company_id=company_id).first()
    if not r:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    r.settled_amount = data.settled_amount
    r.settled_date = data.settled_date
    if data.note:
        r.note = data.note
    r.status = "settled" if data.settled_amount >= r.amount else "partial"
    db.commit()
    db.refresh(r)
    return row_to_dict(r, db, company_id)


@router.delete("/{rid}")
def delete_receivable(rid: int, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    r = db.query(models.Receivable).filter_by(id=rid, company_id=company_id).first()
    if not r:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    db.delete(r)
    db.commit()
    return {"ok": True}
