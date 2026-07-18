from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ReceivableCreate(BaseModel):
    user_id: str
    person_name: str
    amount: int
    due_date: str
    note: Optional[str] = None
    type: str


class ReceivableUpdate(BaseModel):
    person_name: Optional[str] = None
    amount: Optional[int] = None
    due_date: Optional[str] = None
    note: Optional[str] = None
    type: Optional[str] = None


class ReceivableResponse(BaseModel):
    id: str
    user_id: str
    person_name: str
    amount: int
    due_date: str
    note: Optional[str] = None
    type: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
