"""공통 입력 검증 헬퍼 (순환 import 방지를 위해 의존성 없음)"""
import re
from datetime import date as _date

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
BIZ_NO_RE = re.compile(r"^\d{3}-\d{2}-\d{5}$")
PHONE_RE = re.compile(r"^[0-9-]+$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def valid_date(s: str) -> bool:
    if not s or not DATE_RE.match(s):
        return False
    try:
        _date.fromisoformat(s)
        return True
    except ValueError:
        return False


def check_date(v: str, label: str = "날짜") -> str:
    """날짜 형식(YYYY-MM-DD) 검증. 통과 시 trim된 값 반환."""
    v = (v or "").strip()
    if not v:
        raise ValueError(f"{label}는 필수입니다")
    if not valid_date(v):
        raise ValueError(f"{label} 형식이 올바르지 않습니다 (YYYY-MM-DD)")
    return v


def check_biz_no(v: str) -> str:
    """사업자번호 검증. 빈값 허용, 값 있으면 000-00-00000 형식."""
    v = (v or "").strip()
    if v and not BIZ_NO_RE.match(v):
        raise ValueError("사업자번호 형식이 올바르지 않습니다 (000-00-00000)")
    return v


def check_phone(v: str) -> str:
    """전화번호 검증. 빈값 허용, 값 있으면 숫자/하이픈만."""
    v = (v or "").strip()
    if v and not PHONE_RE.match(v):
        raise ValueError("전화번호는 숫자와 하이픈(-)만 입력할 수 있습니다")
    return v


def check_email(v: str) -> str:
    """이메일 검증. 빈값 허용, 값 있으면 형식 검증."""
    v = (v or "").strip()
    if v and not EMAIL_RE.match(v):
        raise ValueError("이메일 형식이 올바르지 않습니다")
    return v


def check_account_no(v: str) -> str:
    """계좌번호 검증. 빈값 허용, 값 있으면 숫자/하이픈만."""
    v = (v or "").strip()
    if v and not PHONE_RE.match(v):
        raise ValueError("계좌번호는 숫자와 하이픈(-)만 입력할 수 있습니다")
    return v


def check_items_amounts(items: list) -> list:
    """items의 각 항목 qty/quantity/price 음수 차단."""
    for it in (items or []):
        if not isinstance(it, dict):
            continue
        qty = it.get("qty", it.get("quantity", 0)) or 0
        price = it.get("price", 0) or 0
        try:
            if float(qty) < 0:
                raise ValueError("수량은 0 이상이어야 합니다")
            if float(price) < 0:
                raise ValueError("단가는 0 이상이어야 합니다")
        except (TypeError, ValueError) as e:
            if isinstance(e, ValueError) and "이상" in str(e):
                raise
            raise ValueError("수량/단가 값이 올바르지 않습니다")
    return items
