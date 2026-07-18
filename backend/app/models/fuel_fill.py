import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, Text
from app.database import Base


class FuelFill(Base):
    __tablename__ = "fuel_fills"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    vehicle = Column(String, nullable=False)
    date = Column(String, nullable=False)
    amount = Column(Integer, nullable=False)
    liters = Column(Float, nullable=False)
    price_per_liter = Column(Integer, nullable=False)
    odometer = Column(Integer, nullable=False)
    station = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
