from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class TransactionCreate(BaseModel):
    user_id: str
    type: str
    amount: int
    currency: str = "INR"
    date: str
    category: str
    notes: Optional[str] = None
    source: str = "manual"
    linked_card_id: Optional[str] = None
    linked_vehicle_id: Optional[str] = None
    linked_holding_id: Optional[str] = None


class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    amount: Optional[int] = None
    currency: Optional[str] = None
    date: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    source: Optional[str] = None
    linked_card_id: Optional[str] = None
    linked_vehicle_id: Optional[str] = None
    linked_holding_id: Optional[str] = None


class TransactionResponse(BaseModel):
    id: str
    user_id: str
    type: str
    amount: int
    currency: str
    date: str
    category: str
    notes: Optional[str] = None
    source: str
    linked_card_id: Optional[str] = None
    linked_vehicle_id: Optional[str] = None
    linked_holding_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
