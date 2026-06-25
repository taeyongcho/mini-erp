from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Any
from database import get_db
import models

router = APIRouter(prefix="/api/orders", tags=["orders"])

class OrderIn(BaseModel):
    id: str
    date: str
    deliver: str
    customer_id: int
    quotation_id: Optional[str] = None
    status: str = "ordered"
    note: str = ""
    items: List[Any] = []

@router.get("")
def list_orders(db: Session = Depends(get_db)):
    rows = db.query(models.Order).all()
    result = []
    for o in rows:
        d = {c.name: getattr(o, c.name) for c in o.__table__.columns}
        d["customer"] = {"id": o.customer.id, "name": o.customer.name} if o.customer else None
        result.append(d)
    return result

@router.post("")
def create_order(data: OrderIn, db: Session = Depends(get_db)):
    if db.query(models.Order).filter_by(id=data.id).first():
        raise HTTPException(400, "이미 존재하는 발주번호입니다")
    o = models.Order(**data.dict())
    db.add(o); db.commit(); db.refresh(o)
    return o

@router.put("/{oid}")
def update_order(oid: str, data: OrderIn, db: Session = Depends(get_db)):
    o = db.query(models.Order).filter_by(id=oid).first()
    if not o: raise HTTPException(404, "Not found")
    for k, v in data.dict().items(): setattr(o, k, v)
    db.commit(); db.refresh(o)
    return o

@router.delete("/{oid}")
def delete_order(oid: str, db: Session = Depends(get_db)):
    o = db.query(models.Order).filter_by(id=oid).first()
    if not o: raise HTTPException(404, "Not found")
    db.delete(o); db.commit()
    return {"ok": True}
