import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime
from app.database import Base


class FixedExpense(Base):
    __tablename__ = "fixed_expenses"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    amount = Column(Integer, nullable=False)
    billing_day = Column(Integer, nullable=False)
    category = Column(String, nullable=False)
    last_paid_month = Column(String, nullable=True)
    due_date = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
