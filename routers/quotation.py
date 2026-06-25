from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Any
from database import get_db
import models

router = APIRouter(prefix="/api/quotations", tags=["quotations"])

class QuotationIn(BaseModel):
    id: str
    date: str
    expire: str
    customer_id: int
    status: str = "draft"
    note: str = ""
    items: List[Any] = []

@router.get("")
def list_quotations(db: Session = Depends(get_db)):
    rows = db.query(models.Quotation).all()
    result = []
    for q in rows:
        d = {c.name: getattr(q, c.name) for c in q.__table__.columns}
        d["customer"] = {"id": q.customer.id, "name": q.customer.name} if q.customer else None
        result.append(d)
    return result

@router.post("")
def create_quotation(data: QuotationIn, db: Session = Depends(get_db)):
    if db.query(models.Quotation).filter_by(id=data.id).first():
        raise HTTPException(400, "이미 존재하는 견적번호입니다")
    q = models.Quotation(**data.dict())
    db.add(q); db.commit(); db.refresh(q)
    return q

@router.put("/{qid}")
def update_quotation(qid: str, data: QuotationIn, db: Session = Depends(get_db)):
    q = db.query(models.Quotation).filter_by(id=qid).first()
    if not q: raise HTTPException(404, "Not found")
    for k, v in data.dict().items(): setattr(q, k, v)
    db.commit(); db.refresh(q)
    return q

@router.delete("/{qid}")
def delete_quotation(qid: str, db: Session = Depends(get_db)):
    q = db.query(models.Quotation).filter_by(id=qid).first()
    if not q: raise HTTPException(404, "Not found")
    db.delete(q); db.commit()
    return {"ok": True}
