from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models import Note, Goal, Recipe, DietPlan
from app.schemas import (
    NoteCreate, NoteUpdate, NoteResponse,
    GoalCreate, GoalUpdate, GoalResponse,
    RecipeCreate, RecipeUpdate, RecipeResponse,
    DietPlanCreate, DietPlanUpdate, DietPlanResponse,
)

router = APIRouter(prefix="/personal", tags=["personal"])


def get_user_id(user_id: str = Query(...)) -> str:
    return user_id


# --- Notes ---

@router.get("/notes", response_model=list[NoteResponse])
def list_notes(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    return db.query(Note).filter(Note.user_id == user_id).order_by(Note.created_at.desc()).all()


@router.post("/notes", response_model=NoteResponse, status_code=201)
def create_note(payload: NoteCreate, db: Session = Depends(get_db)):
    note = Note(**payload.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.put("/notes/{id}", response_model=NoteResponse)
def update_note(id: str, payload: NoteUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == id, Note.user_id == user_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/notes/{id}", status_code=204)
def delete_note(id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == id, Note.user_id == user_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()


# --- Goals ---

@router.get("/goals", response_model=list[GoalResponse])
def list_goals(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    return db.query(Goal).filter(Goal.user_id == user_id).order_by(Goal.created_at.desc()).all()


@router.post("/goals", response_model=GoalResponse, status_code=201)
def create_goal(payload: GoalCreate, db: Session = Depends(get_db)):
    goal = Goal(**payload.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.put("/goals/{id}", response_model=GoalResponse)
def update_goal(id: str, payload: GoalUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    goal = db.query(Goal).filter(Goal.id == id, Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/goals/{id}", status_code=204)
def delete_goal(id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    goal = db.query(Goal).filter(Goal.id == id, Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(goal)
    db.commit()


# --- Recipes ---

@router.get("/recipes", response_model=list[RecipeResponse])
def list_recipes(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    return db.query(Recipe).filter(Recipe.user_id == user_id).order_by(Recipe.created_at.desc()).all()


@router.post("/recipes", response_model=RecipeResponse, status_code=201)
def create_recipe(payload: RecipeCreate, db: Session = Depends(get_db)):
    recipe = Recipe(**payload.model_dump())
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe


@router.put("/recipes/{id}", response_model=RecipeResponse)
def update_recipe(id: str, payload: RecipeUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    recipe = db.query(Recipe).filter(Recipe.id == id, Recipe.user_id == user_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(recipe, key, value)
    db.commit()
    db.refresh(recipe)
    return recipe


@router.delete("/recipes/{id}", status_code=204)
def delete_recipe(id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    recipe = db.query(Recipe).filter(Recipe.id == id, Recipe.user_id == user_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    db.delete(recipe)
    db.commit()


# --- Diet Plans ---

@router.get("/diet-plans", response_model=list[DietPlanResponse])
def list_diet_plans(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    return db.query(DietPlan).filter(DietPlan.user_id == user_id).order_by(DietPlan.day.asc()).all()


@router.post("/diet-plans", response_model=DietPlanResponse, status_code=201)
def create_diet_plan(payload: DietPlanCreate, db: Session = Depends(get_db)):
    plan = DietPlan(**payload.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.put("/diet-plans/{id}", response_model=DietPlanResponse)
def update_diet_plan(id: str, payload: DietPlanUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    plan = db.query(DietPlan).filter(DietPlan.id == id, DietPlan.user_id == user_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Diet plan not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(plan, key, value)
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/diet-plans/{id}", status_code=204)
def delete_diet_plan(id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    plan = db.query(DietPlan).filter(DietPlan.id == id, DietPlan.user_id == user_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Diet plan not found")
    db.delete(plan)
    db.commit()
