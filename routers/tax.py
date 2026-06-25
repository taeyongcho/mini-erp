from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Any
from database import get_db
import models

router = APIRouter(prefix="/api/taxes", tags=["taxes"])

class TaxIn(BaseModel):
    id: str
    date: str
    customer_id: int
    order_id: Optional[str] = None
    status: str = "pending"
    supply: float = 0
    vat: float = 0
    note: str = ""
    items: List[Any] = []

@router.get("")
def list_taxes(db: Session = Depends(get_db)):
    rows = db.query(models.TaxInvoice).all()
    result = []
    for t in rows:
        d = {c.name: getattr(t, c.name) for c in t.__table__.columns}
        d["customer"] = {"id": t.customer.id, "name": t.customer.name} if t.customer else None
        result.append(d)
    return result

@router.post("")
def create_tax(data: TaxIn, db: Session = Depends(get_db)):
    if db.query(models.TaxInvoice).filter_by(id=data.id).first():
        raise HTTPException(400, "이미 존재하는 계산서번호입니다")
    t = models.TaxInvoice(**data.dict())
    db.add(t); db.commit(); db.refresh(t)
    return t

@router.put("/{tid}")
def update_tax(tid: str, data: TaxIn, db: Session = Depends(get_db)):
    t = db.query(models.TaxInvoice).filter_by(id=tid).first()
    if not t: raise HTTPException(404, "Not found")
    for k, v in data.dict().items(): setattr(t, k, v)
    db.commit(); db.refresh(t)
    return t

@router.patch("/{tid}/issue")
def issue_tax(tid: str, db: Session = Depends(get_db)):
    t = db.query(models.TaxInvoice).filter_by(id=tid).first()
    if not t: raise HTTPException(404, "Not found")
    t.status = "issued"
    db.commit(); db.refresh(t)
    return t

@router.delete("/{tid}")
def delete_tax(tid: str, db: Session = Depends(get_db)):
    t = db.query(models.TaxInvoice).filter_by(id=tid).first()
    if not t: raise HTTPException(404, "Not found")
    db.delete(t); db.commit()
    return {"ok": True}
