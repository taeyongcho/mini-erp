from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from routers.auth import require_superadmin
import models

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/companies")
def list_companies(_=Depends(require_superadmin), db: Session = Depends(get_db)):
    rows = db.query(models.Company).all()
    out = []
    for c in rows:
        users = db.query(models.User).filter_by(company_id=c.id).count()
        docs = (db.query(models.Quotation).filter_by(company_id=c.id).count()
                + db.query(models.Contract).filter_by(company_id=c.id).count()
                + db.query(models.Order).filter_by(company_id=c.id).count()
                + db.query(models.TaxInvoice).filter_by(company_id=c.id).count())
        out.append({"id": c.id, "name": c.name, "biz_no": c.biz_no, "plan": c.plan,
                    "active": c.active, "created_at": c.created_at, "users": users, "documents": docs})
    return out


class PlanIn(BaseModel):
    plan: str


@router.patch("/companies/{cid}/plan")
def set_plan(cid: int, body: PlanIn, _=Depends(require_superadmin), db: Session = Depends(get_db)):
    c = db.query(models.Company).filter_by(id=cid).first()
    if not c: raise HTTPException(404, "업체를 찾을 수 없습니다")
    c.plan = body.plan; db.commit()
    return {"ok": True}


@router.patch("/companies/{cid}/active")
def toggle_active(cid: int, _=Depends(require_superadmin), db: Session = Depends(get_db)):
    c = db.query(models.Company).filter_by(id=cid).first()
    if not c: raise HTTPException(404, "업체를 찾을 수 없습니다")
    c.active = not c.active; db.commit()
    return {"ok": True, "active": c.active}
