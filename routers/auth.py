import hashlib, os, hmac, jwt
from datetime import datetime, timedelta, date
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, field_validator
from database import get_db
import models
from routers.validators import check_biz_no, check_email

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)

SECRET = os.environ.get("ERP_SECRET", "mini-erp-secret-key-change-in-prod")
SUPERADMIN_EMAIL = os.environ.get("ERP_ADMIN_EMAIL", "admin@axiosoft.co.kr")
SUPERADMIN_PASS = os.environ.get("ERP_ADMIN_PASS", "admin1234")


def hash_pw(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return salt.hex() + "$" + dk.hex()


def verify_pw(password: str, stored: str) -> bool:
    try:
        salt_hex, dk_hex = stored.split("$")
        salt = bytes.fromhex(salt_hex)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


def make_token(user) -> str:
    payload = {
        "uid": user.id,
        "cid": user.company_id,
        "role": user.role,
        "exp": datetime.utcnow() + timedelta(hours=12),
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")


class SignupIn(BaseModel):
    company_name: str
    email: str
    password: str
    name: str = ""
    biz_no: str = ""

    @field_validator("email")
    @classmethod
    def email_format(cls, v: str) -> str:
        return check_email(v)

    @field_validator("biz_no")
    @classmethod
    def biz_no_format(cls, v: str) -> str:
        return check_biz_no(v)


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/signup")
def signup(body: SignupIn, db: Session = Depends(get_db)):
    if db.query(models.User).filter_by(email=body.email).first():
        raise HTTPException(400, "이미 사용 중인 이메일입니다")
    if len(body.password) < 6:
        raise HTTPException(400, "비밀번호는 6자 이상이어야 합니다")
    today = str(date.today())
    company = models.Company(name=body.company_name, biz_no=body.biz_no, plan="free", active=True, created_at=today)
    db.add(company); db.flush()
    user = models.User(company_id=company.id, email=body.email, password_hash=hash_pw(body.password),
                       name=body.name, role="owner", active=True, created_at=today)
    db.add(user); db.commit(); db.refresh(user)
    return {"token": make_token(user), "user": {"email": user.email, "name": user.name, "role": user.role, "company": company.name}}


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    # 슈퍼어드민 (DB에 없는 환경변수 계정)
    if body.email == SUPERADMIN_EMAIL and body.password == SUPERADMIN_PASS:
        payload = {"uid": 0, "cid": None, "role": "superadmin", "exp": datetime.utcnow() + timedelta(hours=12)}
        return {"token": jwt.encode(payload, SECRET, algorithm="HS256"),
                "user": {"email": SUPERADMIN_EMAIL, "name": "슈퍼관리자", "role": "superadmin", "company": "운영"}}
    user = db.query(models.User).filter_by(email=body.email).first()
    if not user or not verify_pw(body.password, user.password_hash):
        raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다")
    if not user.active:
        raise HTTPException(403, "비활성화된 계정입니다")
    company = db.query(models.Company).filter_by(id=user.company_id).first()
    if company and not company.active:
        raise HTTPException(403, "정지된 업체입니다. 관리자에게 문의하세요")
    return {"token": make_token(user),
            "user": {"email": user.email, "name": user.name, "role": user.role,
                     "company": company.name if company else ""}}


def get_current(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if not credentials:
        raise HTTPException(401, "인증이 필요합니다")
    try:
        payload = jwt.decode(credentials.credentials, SECRET, algorithms=["HS256"])
    except Exception:
        raise HTTPException(401, "인증이 만료되었거나 올바르지 않습니다")
    return payload  # {uid, cid, role}


def get_company_id(payload: dict = Depends(get_current)) -> int:
    """일반 데이터 API용 - company_id 강제. 슈퍼어드민은 cid 없으므로 거부."""
    cid = payload.get("cid")
    if cid is None:
        raise HTTPException(403, "업체 계정으로 로그인해야 합니다")
    return cid


def require_superadmin(payload: dict = Depends(get_current)):
    if payload.get("role") != "superadmin":
        raise HTTPException(403, "권한이 없습니다")
    return payload


@router.get("/me")
def me(payload: dict = Depends(get_current), db: Session = Depends(get_db)):
    if payload.get("role") == "superadmin":
        return {"email": "", "name": "슈퍼관리자", "role": "superadmin", "company": "운영"}
    user = db.query(models.User).filter_by(id=payload["uid"]).first()
    if not user:
        raise HTTPException(401, "사용자를 찾을 수 없습니다")
    company = db.query(models.Company).filter_by(id=user.company_id).first()
    return {"email": user.email, "name": user.name, "role": user.role,
            "company": company.name if company else "", "plan": company.plan if company else "free",
            "biz_no": company.biz_no if company else "",
            "quote_format": company.quote_format if company else "Q-{YYYY}-{seq}",
            "contract_format": company.contract_format if company else "CT-{YYYY}-{seq}",
            "order_format": company.order_format if company else "PO-{YYYY}-{seq}",
            "tax_format": company.tax_format if company else "TAX-{YYYY}-{seq}",
            "smtp_host": company.smtp_host if company else "",
            "smtp_port": company.smtp_port if company else 587,
            "smtp_user": company.smtp_user if company else "",
            "smtp_from": company.smtp_from if company else "",
            "smtp_tls": company.smtp_tls if company else True,
            "smtp_configured": bool(company and company.smtp_host and company.smtp_pass)}


class ProfileIn(BaseModel):
    name: str = ""
    email: str = ""
    company_name: str = ""
    biz_no: str = ""
    quote_format: str = ""
    contract_format: str = ""
    order_format: str = ""
    tax_format: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""   # 빈값이면 기존 비밀번호 유지
    smtp_from: str = ""
    smtp_tls: bool = True

    @field_validator("email")
    @classmethod
    def email_format(cls, v: str) -> str:
        return check_email(v)

    @field_validator("biz_no")
    @classmethod
    def biz_no_format(cls, v: str) -> str:
        return check_biz_no(v)


class PasswordIn(BaseModel):
    current_password: str
    new_password: str


@router.put("/profile")
def update_profile(body: ProfileIn, payload: dict = Depends(get_current), db: Session = Depends(get_db)):
    if payload.get("role") == "superadmin":
        raise HTTPException(403, "슈퍼관리자는 정보를 변경할 수 없습니다")
    user = db.query(models.User).filter_by(id=payload["uid"]).first()
    if not user:
        raise HTTPException(401, "사용자를 찾을 수 없습니다")
    # 이메일 변경 시 중복 체크 (자기 자신 제외)
    if body.email and body.email != user.email:
        dup = db.query(models.User).filter(models.User.email == body.email,
                                           models.User.id != user.id).first()
        if dup:
            raise HTTPException(400, "이미 사용 중인 이메일입니다")
        user.email = body.email
    if body.name:
        user.name = body.name
    company = db.query(models.Company).filter_by(id=user.company_id).first()
    if company:
        if body.company_name:
            company.name = body.company_name
        # biz_no는 빈값으로도 변경 허용
        company.biz_no = body.biz_no
        if body.quote_format:
            company.quote_format = body.quote_format
        if body.contract_format:
            company.contract_format = body.contract_format
        if body.order_format:
            company.order_format = body.order_format
        if body.tax_format:
            company.tax_format = body.tax_format
        company.smtp_host = body.smtp_host
        company.smtp_port = body.smtp_port or 587
        company.smtp_user = body.smtp_user
        company.smtp_from = body.smtp_from
        company.smtp_tls = body.smtp_tls
        if body.smtp_pass:  # 빈값이면 기존 비밀번호 유지
            company.smtp_pass = body.smtp_pass
    db.commit(); db.refresh(user)
    # 이메일/이름이 바뀌면 토큰의 표시정보가 바뀌므로 새 토큰 재발급
    return {"token": make_token(user),
            "user": {"email": user.email, "name": user.name, "role": user.role,
                     "company": company.name if company else "",
                     "plan": company.plan if company else "free",
                     "biz_no": company.biz_no if company else "",
                     "quote_format": company.quote_format if company else "Q-{YYYY}-{seq}",
                     "contract_format": company.contract_format if company else "CT-{YYYY}-{seq}",
                     "order_format": company.order_format if company else "PO-{YYYY}-{seq}",
                     "tax_format": company.tax_format if company else "TAX-{YYYY}-{seq}",
                     "smtp_host": company.smtp_host if company else "",
                     "smtp_port": company.smtp_port if company else 587,
                     "smtp_user": company.smtp_user if company else "",
                     "smtp_from": company.smtp_from if company else "",
                     "smtp_tls": company.smtp_tls if company else True,
                     "smtp_configured": bool(company and company.smtp_host and company.smtp_pass)}}


@router.put("/password")
def change_password(body: PasswordIn, payload: dict = Depends(get_current), db: Session = Depends(get_db)):
    if payload.get("role") == "superadmin":
        raise HTTPException(403, "슈퍼관리자는 비밀번호를 변경할 수 없습니다")
    user = db.query(models.User).filter_by(id=payload["uid"]).first()
    if not user:
        raise HTTPException(401, "사용자를 찾을 수 없습니다")
    if not verify_pw(body.current_password, user.password_hash):
        raise HTTPException(400, "현재 비밀번호가 올바르지 않습니다")
    if len(body.new_password) < 6:
        raise HTTPException(400, "새 비밀번호는 6자 이상이어야 합니다")
    user.password_hash = hash_pw(body.new_password)
    db.commit()
    return {"ok": True}


FREE_DOC_LIMIT = 20  # free 플랜 문서(견적+계약+발주+세금계산서) 총합 제한


def check_doc_limit(company_id: int, db):
    company = db.query(models.Company).filter_by(id=company_id).first()
    if not company or company.plan != "free":
        return
    total = (db.query(models.Quotation).filter_by(company_id=company_id).count()
             + db.query(models.Contract).filter_by(company_id=company_id).count()
             + db.query(models.Order).filter_by(company_id=company_id).count()
             + db.query(models.TaxInvoice).filter_by(company_id=company_id).count())
    if total >= FREE_DOC_LIMIT:
        raise HTTPException(402, f"무료 플랜 문서 한도({FREE_DOC_LIMIT}건)를 초과했습니다. 플랜을 업그레이드하세요")
