from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CreditCardCreate(BaseModel):
    user_id: str
    name: str
    network: str
    ending_with: str
    billing_day: int
    balance: int = 0
    due_date: str


class CreditCardUpdate(BaseModel):
    name: Optional[str] = None
    network: Optional[str] = None
    ending_with: Optional[str] = None
    billing_day: Optional[int] = None
    balance: Optional[int] = None
    due_date: Optional[str] = None


class CreditCardResponse(BaseModel):
    id: str
    user_id: str
    name: str
    network: str
    ending_with: str
    billing_day: int
    balance: int
    due_date: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
