from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Any
from database import get_db
import models

router = APIRouter(prefix="/api/contracts", tags=["contracts"])

class ContractIn(BaseModel):
    id: str
    date: str
    start_date: str
    end_date: str
    customer_id: int
    quotation_id: Optional[str] = None
    status: str = "reviewing"
    title: str = ""
    amount: float = 0
    payment_terms: str = ""
    delivery_terms: str = ""
    warranty: str = ""
    special_terms: str = ""
    items: List[Any] = []
    note: str = ""

def serialize(c):
    d = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    d["customer"] = {"id": c.customer.id, "name": c.customer.name} if c.customer else None
    # 만료 D-day 계산
    from datetime import date
    try:
        delta = (date.fromisoformat(c.end_date) - date.today()).days
        d["days_left"] = delta
    except:
        d["days_left"] = None
    return d

@router.get("")
def list_contracts(db: Session = Depends(get_db)):
    return [serialize(c) for c in db.query(models.Contract).all()]

@router.get("/{cid}")
def get_contract(cid: str, db: Session = Depends(get_db)):
    c = db.query(models.Contract).filter_by(id=cid).first()
    if not c: raise HTTPException(404, "Not found")
    return serialize(c)

@router.post("")
def create_contract(data: ContractIn, db: Session = Depends(get_db)):
    if db.query(models.Contract).filter_by(id=data.id).first():
        raise HTTPException(400, "이미 존재하는 계약번호입니다")
    c = models.Contract(**data.dict())
    db.add(c); db.commit(); db.refresh(c)
    return serialize(c)

@router.put("/{cid}")
def update_contract(cid: str, data: ContractIn, db: Session = Depends(get_db)):
    c = db.query(models.Contract).filter_by(id=cid).first()
    if not c: raise HTTPException(404, "Not found")
    for k, v in data.dict().items(): setattr(c, k, v)
    db.commit(); db.refresh(c)
    return serialize(c)

@router.patch("/{cid}/status")
def update_status(cid: str, payload: dict, db: Session = Depends(get_db)):
    c = db.query(models.Contract).filter_by(id=cid).first()
    if not c: raise HTTPException(404, "Not found")
    c.status = payload.get("status", c.status)
    db.commit(); db.refresh(c)
    return serialize(c)

@router.delete("/{cid}")
def delete_contract(cid: str, db: Session = Depends(get_db)):
    c = db.query(models.Contract).filter_by(id=cid).first()
    if not c: raise HTTPException(404, "Not found")
    db.delete(c); db.commit()
    return {"ok": True}
