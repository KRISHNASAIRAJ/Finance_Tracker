from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class GoalCreate(BaseModel):
    user_id: str
    title: str


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    is_completed: Optional[bool] = None


class GoalResponse(BaseModel):
    id: str
    user_id: str
    title: str
    is_completed: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
