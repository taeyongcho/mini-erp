from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import List, Optional, Any
from database import get_db
import models
from models import QuotationStatus

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
        if not v.startswith("Q-"):
            raise ValueError("견적번호는 Q- 로 시작해야 합니다")
        return v

    @field_validator("date", "expire")
    @classmethod
    def date_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("날짜는 필수입니다")
        return v.strip()


@router.get("")
def list_quotations(db: Session = Depends(get_db)):
    rows = db.query(models.Quotation).all()
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
def create_quotation(data: QuotationIn, db: Session = Depends(get_db)):
    if db.query(models.Quotation).filter_by(id=data.id).first():
        raise HTTPException(400, "이미 존재하는 견적번호입니다")
    customer = db.query(models.Customer).filter_by(id=data.customer_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    q = models.Quotation(**data.dict())
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


@router.put("/{qid}")
def update_quotation(qid: str, data: QuotationIn, db: Session = Depends(get_db)):
    q = db.query(models.Quotation).filter_by(id=qid).first()
    if not q:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    customer = db.query(models.Customer).filter_by(id=data.customer_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    for k, v in data.dict().items():
        setattr(q, k, v)
    db.commit()
    db.refresh(q)
    return q


@router.delete("/{qid}")
def delete_quotation(qid: str, db: Session = Depends(get_db)):
    q = db.query(models.Quotation).filter_by(id=qid).first()
    if not q:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    db.delete(q)
    db.commit()
    return {"ok": True}
