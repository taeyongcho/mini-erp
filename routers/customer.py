from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, field_validator
from typing import Optional
from database import get_db
import models
from routers.auth import get_company_id
from routers.validators import check_biz_no, check_phone, check_email

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

    @field_validator("biz_no")
    @classmethod
    def biz_no_format(cls, v: str) -> str:
        return check_biz_no(v)

    @field_validator("phone")
    @classmethod
    def phone_format(cls, v: str) -> str:
        return check_phone(v)

    @field_validator("email")
    @classmethod
    def email_format(cls, v: str) -> str:
        return check_email(v)


@router.get("")
def list_customers(db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    return db.query(models.Customer).filter_by(company_id=company_id).all()


@router.post("")
def create_customer(data: CustomerIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    try:
        c = models.Customer(**data.dict(), company_id=company_id)
        db.add(c)
        db.commit()
        db.refresh(c)
        return c
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "데이터 무결성 오류가 발생했습니다")


@router.put("/{cid}")
def update_customer(cid: int, data: CustomerIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    c = db.query(models.Customer).filter_by(id=cid, company_id=company_id).first()
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
def delete_customer(cid: int, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    c = db.query(models.Customer).filter_by(id=cid, company_id=company_id).first()
    if not c:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")

    # 참조 문서 확인
    has_ref = (
        db.query(models.Quotation).filter_by(customer_id=cid, company_id=company_id).first()
        or db.query(models.Contract).filter_by(customer_id=cid, company_id=company_id).first()
        or db.query(models.Order).filter_by(customer_id=cid, company_id=company_id).first()
        or db.query(models.TaxInvoice).filter_by(customer_id=cid, company_id=company_id).first()
    )
    if has_ref:
        raise HTTPException(400, "이 거래처를 참조하는 문서가 있습니다")

    db.delete(c)
    db.commit()
    return {"ok": True}
