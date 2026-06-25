import enum
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


class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    ceo = Column(String, default="")
    biz_no = Column(String, default="")
    addr = Column(String, default="")
    phone = Column(String, default="")
    email = Column(String, default="")
    type = Column(String, default="법인")


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    unit = Column(String, default="개")
    price = Column(Float, default=0)
    tax = Column(Boolean, default=True)


class Quotation(Base):
    __tablename__ = "quotations"
    id = Column(String, primary_key=True)
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
    date = Column(String, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    order_id = Column(String, nullable=True)
    status = Column(SAEnum(TaxStatus), default=TaxStatus.pending)
    supply = Column(Float, default=0)
    vat = Column(Float, default=0)
    note = Column(Text, default="")
    items = Column(JSON, default=[])
    customer = relationship("Customer")
