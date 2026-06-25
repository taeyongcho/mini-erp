from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
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

@router.get("")
def list_customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).all()

@router.post("")
def create_customer(data: CustomerIn, db: Session = Depends(get_db)):
    c = models.Customer(**data.dict())
    db.add(c); db.commit(); db.refresh(c)
    return c

@router.put("/{cid}")
def update_customer(cid: int, data: CustomerIn, db: Session = Depends(get_db)):
    c = db.query(models.Customer).filter_by(id=cid).first()
    if not c: raise HTTPException(404, "Not found")
    for k, v in data.dict().items(): setattr(c, k, v)
    db.commit(); db.refresh(c)
    return c

@router.delete("/{cid}")
def delete_customer(cid: int, db: Session = Depends(get_db)):
    c = db.query(models.Customer).filter_by(id=cid).first()
    if not c: raise HTTPException(404, "Not found")
    db.delete(c); db.commit()
    return {"ok": True}
