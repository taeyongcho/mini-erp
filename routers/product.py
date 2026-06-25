from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
import models

router = APIRouter(prefix="/api/products", tags=["products"])

class ProductIn(BaseModel):
    code: str
    name: str
    unit: str = "개"
    price: float = 0
    tax: bool = True

@router.get("")
def list_products(db: Session = Depends(get_db)):
    return db.query(models.Product).all()

@router.post("")
def create_product(data: ProductIn, db: Session = Depends(get_db)):
    p = models.Product(**data.dict())
    db.add(p); db.commit(); db.refresh(p)
    return p

@router.put("/{pid}")
def update_product(pid: int, data: ProductIn, db: Session = Depends(get_db)):
    p = db.query(models.Product).filter_by(id=pid).first()
    if not p: raise HTTPException(404, "Not found")
    for k, v in data.dict().items(): setattr(p, k, v)
    db.commit(); db.refresh(p)
    return p

@router.delete("/{pid}")
def delete_product(pid: int, db: Session = Depends(get_db)):
    p = db.query(models.Product).filter_by(id=pid).first()
    if not p: raise HTTPException(404, "Not found")
    db.delete(p); db.commit()
    return {"ok": True}
