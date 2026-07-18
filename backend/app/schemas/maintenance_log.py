from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MaintenanceLogCreate(BaseModel):
    user_id: str
    vehicle: str
    date: str
    amount: int
    service_type: str
    notes: Optional[str] = None


class MaintenanceLogUpdate(BaseModel):
    vehicle: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[int] = None
    service_type: Optional[str] = None
    notes: Optional[str] = None


class MaintenanceLogResponse(BaseModel):
    id: str
    user_id: str
    vehicle: str
    date: str
    amount: int
    service_type: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
