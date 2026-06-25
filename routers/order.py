from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import List, Optional, Any
from database import get_db
import models
from models import OrderStatus

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

    @field_validator("date", "deliver")
    @classmethod
    def date_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("날짜는 필수입니다")
        return v.strip()


@router.get("")
def list_orders(db: Session = Depends(get_db)):
    rows = db.query(models.Order).all()
    result = []
    for o in rows:
        d = {c.name: getattr(o, c.name) for c in o.__table__.columns}
        if d.get("status") and hasattr(d["status"], "value"):
            d["status"] = d["status"].value
        d["customer"] = {"id": o.customer.id, "name": o.customer.name} if o.customer else None
        result.append(d)
    return result


@router.post("")
def create_order(data: OrderIn, db: Session = Depends(get_db)):
    if db.query(models.Order).filter_by(id=data.id).first():
        raise HTTPException(400, "이미 존재하는 수주번호입니다")
    customer = db.query(models.Customer).filter_by(id=data.customer_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    o = models.Order(**data.dict())
    db.add(o)
    db.commit()
    db.refresh(o)
    return o


@router.put("/{oid}")
def update_order(oid: str, data: OrderIn, db: Session = Depends(get_db)):
    o = db.query(models.Order).filter_by(id=oid).first()
    if not o:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    customer = db.query(models.Customer).filter_by(id=data.customer_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    for k, v in data.dict().items():
        setattr(o, k, v)
    db.commit()
    db.refresh(o)
    return o


@router.delete("/{oid}")
def delete_order(oid: str, db: Session = Depends(get_db)):
    o = db.query(models.Order).filter_by(id=oid).first()
    if not o:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    # 세금계산서에서 참조 중인지 확인
    ref_tax = db.query(models.TaxInvoice).filter_by(order_id=oid).first()
    if ref_tax:
        raise HTTPException(400, "이 수주를 참조하는 세금계산서가 있습니다")
    db.delete(o)
    db.commit()
    return {"ok": True}
