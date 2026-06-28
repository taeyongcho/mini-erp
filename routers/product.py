from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, field_validator
from database import get_db
import models
from routers.auth import get_company_id

router = APIRouter(prefix="/api/products", tags=["products"])


class ProductIn(BaseModel):
    code: str
    name: str
    unit: str = "개"
    price: float = 0
    tax: bool = True

    @field_validator("code")
    @classmethod
    def code_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("품목코드는 필수입니다")
        return v.strip()

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("품목명은 필수입니다")
        return v.strip()


@router.get("")
def list_products(db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    return db.query(models.Product).filter_by(company_id=company_id).all()


@router.post("")
def create_product(data: ProductIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    existing = db.query(models.Product).filter_by(code=data.code, company_id=company_id).first()
    if existing:
        raise HTTPException(400, "이미 존재하는 품목코드입니다")
    try:
        p = models.Product(**data.dict(), company_id=company_id)
        db.add(p)
        db.commit()
        db.refresh(p)
        return p
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "이미 존재하는 품목코드입니다")


@router.put("/{pid}")
def update_product(pid: int, data: ProductIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    p = db.query(models.Product).filter_by(id=pid, company_id=company_id).first()
    if not p:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    # code 중복 확인 (자기 자신 제외)
    dup = db.query(models.Product).filter(
        models.Product.code == data.code,
        models.Product.id != pid,
        models.Product.company_id == company_id
    ).first()
    if dup:
        raise HTTPException(400, "이미 존재하는 품목코드입니다")
    try:
        for k, v in data.dict().items():
            setattr(p, k, v)
        db.commit()
        db.refresh(p)
        return p
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "이미 존재하는 품목코드입니다")


@router.delete("/{pid}")
def delete_product(pid: int, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    p = db.query(models.Product).filter_by(id=pid, company_id=company_id).first()
    if not p:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    db.delete(p)
    db.commit()
    return {"ok": True}
