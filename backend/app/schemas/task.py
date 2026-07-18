from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class TaskCreate(BaseModel):
    user_id: str
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    due_date: Optional[str] = None
    subtasks: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    is_completed: Optional[bool] = None
    subtasks: Optional[str] = None


class TaskResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = None
    priority: str
    due_date: Optional[str] = None
    is_completed: bool
    subtasks: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
