from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class DietPlanCreate(BaseModel):
    user_id: str
    day: str
    meal_type: str
    meal_name: str
    description: Optional[str] = None


class DietPlanUpdate(BaseModel):
    day: Optional[str] = None
    meal_type: Optional[str] = None
    meal_name: Optional[str] = None
    description: Optional[str] = None


class DietPlanResponse(BaseModel):
    id: str
    user_id: str
    day: str
    meal_type: str
    meal_name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
