from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class RecipeCreate(BaseModel):
    user_id: str
    title: str
    prep_time: Optional[int] = None
    calories: Optional[int] = None
    ingredients: Optional[str] = None
    steps: Optional[str] = None


class RecipeUpdate(BaseModel):
    title: Optional[str] = None
    prep_time: Optional[int] = None
    calories: Optional[int] = None
    ingredients: Optional[str] = None
    steps: Optional[str] = None


class RecipeResponse(BaseModel):
    id: str
    user_id: str
    title: str
    prep_time: Optional[int] = None
    calories: Optional[int] = None
    ingredients: Optional[str] = None
    steps: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
