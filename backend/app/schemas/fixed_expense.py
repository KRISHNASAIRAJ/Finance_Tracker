from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class FixedExpenseCreate(BaseModel):
    user_id: str
    name: str
    amount: int
    billing_day: int
    category: str
    last_paid_month: Optional[str] = None
    due_date: str


class FixedExpenseUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[int] = None
    billing_day: Optional[int] = None
    category: Optional[str] = None
    last_paid_month: Optional[str] = None
    due_date: Optional[str] = None


class FixedExpenseResponse(BaseModel):
    id: str
    user_id: str
    name: str
    amount: int
    billing_day: int
    category: str
    last_paid_month: Optional[str] = None
    due_date: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
