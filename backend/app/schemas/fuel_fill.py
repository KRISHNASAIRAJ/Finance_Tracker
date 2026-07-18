from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class FuelFillCreate(BaseModel):
    user_id: str
    vehicle: str
    date: str
    amount: int
    liters: float
    price_per_liter: int
    odometer: int
    station: Optional[str] = None
    note: Optional[str] = None


class FuelFillUpdate(BaseModel):
    vehicle: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[int] = None
    liters: Optional[float] = None
    price_per_liter: Optional[int] = None
    odometer: Optional[int] = None
    station: Optional[str] = None
    note: Optional[str] = None


class FuelFillResponse(BaseModel):
    id: str
    user_id: str
    vehicle: str
    date: str
    amount: int
    liters: float
    price_per_liter: int
    odometer: int
    station: Optional[str] = None
    note: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
