from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator, Field
from typing import Optional
from database import get_db
import models
from routers.auth import get_company_id
from routers.validators import check_account_no

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


class AccountIn(BaseModel):
    bank_name: str
    account_no: str = ""
    balance: float = Field(default=0, ge=0)
    note: str = ""

    @field_validator("bank_name")
    @classmethod
    def bank_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("은행명은 필수입니다")
        return v.strip()

    @field_validator("account_no")
    @classmethod
    def account_no_format(cls, v: str) -> str:
        return check_account_no(v)


@router.get("")
def list_accounts(db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    rows = db.query(models.AccountBalance).filter_by(company_id=company_id).all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


@router.post("")
def create_account(data: AccountIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    a = models.AccountBalance(
        bank_name=data.bank_name,
        account_no=data.account_no,
        balance=data.balance,
        note=data.note,
        updated_at=str(date.today()),
        company_id=company_id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return {c.name: getattr(a, c.name) for c in a.__table__.columns}


@router.put("/{aid}")
def update_account(aid: int, data: AccountIn, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    a = db.query(models.AccountBalance).filter_by(id=aid, company_id=company_id).first()
    if not a:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    a.bank_name = data.bank_name
    a.account_no = data.account_no
    a.balance = data.balance
    a.note = data.note
    a.updated_at = str(date.today())
    db.commit()
    db.refresh(a)
    return {c.name: getattr(a, c.name) for c in a.__table__.columns}


@router.delete("/{aid}")
def delete_account(aid: int, db: Session = Depends(get_db), company_id: int = Depends(get_company_id)):
    a = db.query(models.AccountBalance).filter_by(id=aid, company_id=company_id).first()
    if not a:
        raise HTTPException(404, "해당 항목을 찾을 수 없습니다")
    db.delete(a)
    db.commit()
    return {"ok": True}
