from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt
import os
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer()

SECRET = os.environ.get("ERP_SECRET", "mini-erp-secret-key-change-in-prod")
ADMIN_USER = os.environ.get("ERP_USER", "admin")
ADMIN_PASS = os.environ.get("ERP_PASS", "admin1234")

class LoginIn(BaseModel):
    username: str
    password: str

def make_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.utcnow() + timedelta(hours=8)
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET, algorithms=["HS256"])
        return payload["sub"]
    except Exception:
        raise HTTPException(401, "인증이 필요합니다")

@router.post("/login")
def login(body: LoginIn):
    if body.username != ADMIN_USER or body.password != ADMIN_PASS:
        raise HTTPException(401, "아이디 또는 비밀번호가 올바르지 않습니다")
    return {"token": make_token(body.username), "username": body.username}

@router.get("/me")
def me(user: str = Depends(verify_token)):
    return {"username": user}
