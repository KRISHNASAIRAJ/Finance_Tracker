from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class UserCreate(BaseModel):
    name: str
    email: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    goals: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    goals: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    goals: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
