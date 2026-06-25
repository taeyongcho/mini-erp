from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, field_validator
from typing import Optional
from database import get_db
import models

router = APIRouter(prefix="/api/customers", tags=["customers"])


class CustomerIn(BaseModel):
    name: str
    ceo: str = ""
    biz_no: str = ""
    addr: str = ""
    phone: str = ""
    email: str = ""
    type: str = "법인"

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("거래처명은 필수입니다")
        return v.strip()


@router.get("")
def list_customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).all()


@router.post("")
def create_customer(data: CustomerIn, db: Session = Depends(get_db)):
    try:
        c = models.Customer(**data.dict())
        db.add(c)
        db.commit()
        db.refresh(c)
        return c
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "데이터 무결성 오류가 발생했습니다")


@router.put("/{cid}")
def update_customer(cid: int, data: CustomerIn, db: Session = Depends(get_db)):
    c = db.query(models.Customer).filter_by(id=cid).first()
    if not c:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    try:
        for k, v in data.dict().items():
            setattr(c, k, v)
        db.commit()
        db.refresh(c)
        return c
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "데이터 무결성 오류가 발생했습니다")


@router.delete("/{cid}")
def delete_customer(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Customer).filter_by(id=cid).first()
    if not c:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")

    # 참조 문서 확인
    has_ref = (
        db.query(models.Quotation).filter_by(customer_id=cid).first()
        or db.query(models.Contract).filter_by(customer_id=cid).first()
        or db.query(models.Order).filter_by(customer_id=cid).first()
        or db.query(models.TaxInvoice).filter_by(customer_id=cid).first()
    )
    if has_ref:
        raise HTTPException(400, "이 거래처를 참조하는 문서가 있습니다")

    db.delete(c)
    db.commit()
    return {"ok": True}
