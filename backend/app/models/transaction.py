import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Text
from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    type = Column(String, nullable=False)
    amount = Column(Integer, nullable=False)
    currency = Column(String, default="INR")
    date = Column(String, nullable=False)
    category = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    source = Column(String, default="manual")
    linked_card_id = Column(String, nullable=True)
    linked_vehicle_id = Column(String, nullable=True)
    linked_holding_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
