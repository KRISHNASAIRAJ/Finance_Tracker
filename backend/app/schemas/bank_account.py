from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class BankAccountCreate(BaseModel):
    user_id: str
    title: str
    amount: int = 0


class BankAccountUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[int] = None


class BankAccountResponse(BaseModel):
    id: str
    user_id: str
    title: str
    amount: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
