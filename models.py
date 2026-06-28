import enum
from datetime import date
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Text, JSON, Enum as SAEnum
from sqlalchemy.orm import relationship
from database import Base


class QuotationStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    approved = "approved"
    rejected = "rejected"


class ContractStatus(str, enum.Enum):
    reviewing = "reviewing"
    waiting_sign = "waiting_sign"
    active = "active"
    renewing = "renewing"
    expired = "expired"
    terminated = "terminated"


class OrderStatus(str, enum.Enum):
    ordered = "ordered"
    completed = "completed"


class TaxStatus(str, enum.Enum):
    pending = "pending"
    issued = "issued"


class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)          # 업체명(상호)
    biz_no = Column(String, default="")            # 사업자번호
    plan = Column(String, default="free")          # free / pro
    active = Column(Boolean, default=True)         # 정지 여부
    quote_format = Column(String, default="Q-{YYYY}-{seq}")  # 견적번호 포맷 템플릿
    contract_format = Column(String, default="CT-{YYYY}-{seq}")  # 계약번호 포맷 템플릿
    order_format = Column(String, default="PO-{YYYY}-{seq}")      # 발주번호 포맷 템플릿
    tax_format = Column(String, default="TAX-{YYYY}-{seq}")       # 세금계산서번호 포맷 템플릿
    smtp_host = Column(String, default="")
    smtp_port = Column(Integer, default=587)
    smtp_user = Column(String, default="")
    smtp_pass = Column(String, default="")   # 앱 비밀번호 (쓰기 전용)
    smtp_from = Column(String, default="")   # 보내는사람 표시 (없으면 smtp_user)
    smtp_tls = Column(Boolean, default=True) # True=STARTTLS(587), False=SSL(465)
    created_at = Column(String, default="")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)  # 슈퍼어드민은 null
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, default="")
    role = Column(String, default="owner")         # owner / member / superadmin
    active = Column(Boolean, default=True)
    created_at = Column(String, default="")


class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True)
    name = Column(String, nullable=False)
    ceo = Column(String, default="")
    biz_no = Column(String, default="")
    addr = Column(String, default="")
    phone = Column(String, default="")
    email = Column(String, default="")
    type = Column(String, default="법인")
    biz_type = Column(String, default="")     # 업태
    biz_item = Column(String, default="")     # 종목
    tax_manager = Column(String, default="")  # 계산서 수신 담당자
    tax_phone = Column(String, default="")    # 계산서 담당자 연락처
    tax_email = Column(String, default="")    # 계산서 수신 메일


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    unit = Column(String, default="개")
    price = Column(Float, default=0)
    tax = Column(Boolean, default=True)


class Quotation(Base):
    __tablename__ = "quotations"
    id = Column(String, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True)
    date = Column(String, nullable=False)
    expire = Column(String, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    status = Column(SAEnum(QuotationStatus), default=QuotationStatus.draft)
    note = Column(Text, default="")
    items = Column(JSON, default=[])
    customer = relationship("Customer")


class Contract(Base):
    __tablename__ = "contracts"
    id = Column(String, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True)
    date = Column(String, nullable=False)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    quotation_id = Column(String, nullable=True)
    status = Column(SAEnum(ContractStatus), default=ContractStatus.reviewing)
    title = Column(String, default="")
    amount = Column(Float, default=0)
    payment_terms = Column(Text, default="")
    delivery_terms = Column(Text, default="")
    warranty = Column(Text, default="")
    special_terms = Column(Text, default="")
    items = Column(JSON, default=[])
    note = Column(Text, default="")
    customer = relationship("Customer")


class Order(Base):
    __tablename__ = "orders"
    id = Column(String, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True)
    date = Column(String, nullable=False)
    deliver = Column(String, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    quotation_id = Column(String, nullable=True)
    contract_id = Column(String, nullable=True)
    status = Column(SAEnum(OrderStatus), default=OrderStatus.ordered)
    note = Column(Text, default="")
    items = Column(JSON, default=[])
    customer = relationship("Customer")


class TaxInvoice(Base):
    __tablename__ = "tax_invoices"
    id = Column(String, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True)
    date = Column(String, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    order_id = Column(String, nullable=True)
    status = Column(SAEnum(TaxStatus), default=TaxStatus.pending)
    supply = Column(Float, default=0)
    vat = Column(Float, default=0)
    note = Column(Text, default="")
    items = Column(JSON, default=[])
    customer = relationship("Customer")


class Receivable(Base):
    __tablename__ = "receivables"
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True)
    tax_invoice_id = Column(String, ForeignKey("tax_invoices.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    amount = Column(Float, default=0)
    due_date = Column(String)
    status = Column(String, default="pending")
    settled_amount = Column(Float, default=0)
    settled_date = Column(String, nullable=True)
    note = Column(Text, default="")
    created_at = Column(String, default="")


class Payable(Base):
    __tablename__ = "payables"
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True)
    order_id = Column(String, ForeignKey("orders.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    amount = Column(Float, default=0)
    due_date = Column(String)
    status = Column(String, default="pending")
    settled_amount = Column(Float, default=0)
    settled_date = Column(String, nullable=True)
    note = Column(Text, default="")
    created_at = Column(String, default="")


class AccountBalance(Base):
    __tablename__ = "account_balances"
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True)
    bank_name = Column(String, nullable=False)
    account_no = Column(String, default="")
    balance = Column(Float, default=0)
    updated_at = Column(String, default="")
    note = Column(String, default="")
