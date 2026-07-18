from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models import (
    Transaction, CreditCard, BankAccount, Receivable, FixedExpense,
    FuelFill, MaintenanceLog, Task, Note, Goal, Recipe, DietPlan,
)
from app.schemas import SyncPayload, SyncUploadRequest, SyncDownloadRequest, SyncDownloadResponse

router = APIRouter(prefix="/sync", tags=["sync"])

ENTITY_MODEL_MAP = {
    "transaction": (Transaction, "created_at"),
    "credit_card": (CreditCard, "created_at"),
    "bank_account": (BankAccount, "created_at"),
    "receivable": (Receivable, "created_at"),
    "fixed_expense": (FixedExpense, "created_at"),
    "fuel_fill": (FuelFill, "created_at"),
    "maintenance_log": (MaintenanceLog, "created_at"),
    "task": (Task, "created_at"),
    "note": (Note, "created_at"),
    "goal": (Goal, "created_at"),
    "recipe": (Recipe, "created_at"),
    "diet_plan": (DietPlan, "created_at"),
}


@router.post("/upload")
def sync_upload(payload: SyncUploadRequest, db: Session = Depends(get_db)):
    results = []
    for item in payload.payloads:
        entity = item.entity
        action = item.action
        data = item.data

        model_info = ENTITY_MODEL_MAP.get(entity)
        if not model_info:
            results.append({"entity": entity, "action": action, "status": "error", "detail": f"Unknown entity: {entity}"})
            continue

        model_cls = model_info[0]
        try:
            if action == "create":
                obj = model_cls(**data)
                db.add(obj)
                db.commit()
                db.refresh(obj)
                results.append({"entity": entity, "action": action, "status": "ok", "id": obj.id})
            elif action == "update":
                obj_id = data.pop("id", None)
                if not obj_id:
                    results.append({"entity": entity, "action": action, "status": "error", "detail": "Missing id"})
                    continue
                obj = db.query(model_cls).filter(model_cls.id == obj_id).first()
                if not obj:
                    results.append({"entity": entity, "action": action, "status": "error", "detail": "Not found"})
                    continue
                for key, value in data.items():
                    setattr(obj, key, value)
                db.commit()
                db.refresh(obj)
                results.append({"entity": entity, "action": action, "status": "ok", "id": obj.id})
            elif action == "delete":
                obj_id = data.get("id")
                if not obj_id:
                    results.append({"entity": entity, "action": action, "status": "error", "detail": "Missing id"})
                    continue
                obj = db.query(model_cls).filter(model_cls.id == obj_id).first()
                if not obj:
                    results.append({"entity": entity, "action": action, "status": "error", "detail": "Not found"})
                    continue
                db.delete(obj)
                db.commit()
                results.append({"entity": entity, "action": action, "status": "ok", "id": obj_id})
            else:
                results.append({"entity": entity, "action": action, "status": "error", "detail": f"Unknown action: {action}"})
        except Exception as e:
            db.rollback()
            results.append({"entity": entity, "action": action, "status": "error", "detail": str(e)})

    return {"results": results}


@router.post("/download", response_model=SyncDownloadResponse)
def sync_download(payload: SyncDownloadRequest, db: Session = Depends(get_db)):
    try:
        last_sync_dt = datetime.fromisoformat(payload.last_sync)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid last_sync format. Use ISO-8601.")

    result = SyncDownloadResponse()

    for entity_key, (model_cls, field_name) in ENTITY_MODEL_MAP.items():
        time_field = getattr(model_cls, field_name)
        records = db.query(model_cls).filter(time_field > last_sync_dt).all()
        entity_attr = entity_key + "s" if not entity_key.endswith("s") else entity_key + "es"

        plural_map = {
            "transaction": "transactions",
            "credit_card": "credit_cards",
            "bank_account": "bank_accounts",
            "receivable": "receivables",
            "fixed_expense": "fixed_expenses",
            "fuel_fill": "fuel_fills",
            "maintenance_log": "maintenance_logs",
            "task": "tasks",
            "note": "notes",
            "goal": "goals",
            "recipe": "recipes",
            "diet_plan": "diet_plans",
        }

        attr_name = plural_map[entity_key]
        rows = []
        for record in records:
            row = {c.name: getattr(record, c.name) for c in model_cls.__table__.columns}
            if isinstance(row.get(field_name), datetime):
                row[field_name] = row[field_name].isoformat()
            rows.append(row)
        setattr(result, attr_name, rows)

    result.server_time = datetime.now(timezone.utc).isoformat()
    return result
