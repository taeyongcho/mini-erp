from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import List, Optional, Any
from database import get_db
import models
from models import ContractStatus
from routers.auth import get_company_id, check_doc_limit

router = APIRouter(prefix="/api/contracts", tags=["contracts"])


class ContractIn(BaseModel):
    id: str
    date: str
    start_date: str
    end_date: str
    customer_id: int
    quotation_id: Optional[str] = None
    status: ContractStatus = ContractStatus.reviewing
    title: str
    amount: float = 0
    payment_terms: str = ""
    delivery_terms: str = ""
    warranty: str = ""
    special_terms: str = ""
    items: List[Any] = []
    note: str = ""

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("계약명은 필수입니다")
        return v.strip()


def serialize(c):
    d = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    # Enum -> str
    if d.get("status") and hasattr(d["status"], "value"):
        d["status"] = d["status"].value
    d["customer"] = {"id": c.customer.id, "name": c.customer.name} if c.customer else None
    from datetime import date
    try:
        delta = (date.fromisoformat(c.end_date) - date.today()).days
        d["days_left"] = delta
    except Exception:
        d["days_left"] = None
    return d


@router.get("")
def list_contracts(db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    return [serialize(c) for c in db.query(models.Contract).filter_by(company_id=company_id).all()]


@router.get("/{cid}")
def get_contract(cid: str, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    c = db.query(models.Contract).filter_by(id=cid, company_id=company_id).first()
    if not c:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    return serialize(c)


@router.post("")
def create_contract(data: ContractIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    check_doc_limit(company_id, db)
    if db.query(models.Contract).filter_by(id=data.id, company_id=company_id).first():
        raise HTTPException(400, "이미 존재하는 계약번호입니다")
    customer = db.query(models.Customer).filter_by(id=data.customer_id, company_id=company_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    c = models.Contract(**data.dict(), company_id=company_id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return serialize(c)


@router.put("/{cid}")
def update_contract(cid: str, data: ContractIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    c = db.query(models.Contract).filter_by(id=cid, company_id=company_id).first()
    if not c:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    customer = db.query(models.Customer).filter_by(id=data.customer_id, company_id=company_id).first()
    if not customer:
        raise HTTPException(400, "존재하지 않는 거래처입니다")
    for k, v in data.dict().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return serialize(c)


@router.patch("/{cid}/status")
def update_status(cid: str, payload: dict, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    c = db.query(models.Contract).filter_by(id=cid, company_id=company_id).first()
    if not c:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    new_status = payload.get("status")
    if new_status:
        try:
            c.status = ContractStatus(new_status)
        except ValueError:
            raise HTTPException(400, f"유효하지 않은 상태값입니다: {new_status}")
    db.commit()
    db.refresh(c)
    return serialize(c)


@router.delete("/{cid}")
def delete_contract(cid: str, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    c = db.query(models.Contract).filter_by(id=cid, company_id=company_id).first()
    if not c:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    # 수주에서 참조 중인지 확인
    ref_order = db.query(models.Order).filter_by(contract_id=cid, company_id=company_id).first()
    if ref_order:
        raise HTTPException(400, "이 계약을 참조하는 수주가 있습니다")
    db.delete(c)
    db.commit()
    return {"ok": True}
