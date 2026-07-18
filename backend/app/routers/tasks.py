from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models import Task
from app.schemas import TaskCreate, TaskUpdate, TaskResponse

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_user_id(user_id: str = Query(...)) -> str:
    return user_id


@router.get("", response_model=list[TaskResponse])
def list_tasks(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    return db.query(Task).filter(Task.user_id == user_id).order_by(Task.created_at.desc()).all()


@router.post("", response_model=TaskResponse, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.put("/{id}", response_model=TaskResponse)
def update_task(id: str, payload: TaskUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == id, Task.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{id}", status_code=204)
def delete_task(id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == id, Task.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()


@router.patch("/{id}/toggle", response_model=TaskResponse)
def toggle_task(id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == id, Task.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_completed = not task.is_completed
    db.commit()
    db.refresh(task)
    return task
