from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models import FuelFill, MaintenanceLog
from app.schemas import FuelFillCreate, FuelFillUpdate, FuelFillResponse
from app.schemas import MaintenanceLogCreate, MaintenanceLogUpdate, MaintenanceLogResponse

router = APIRouter(prefix="/garage", tags=["garage"])


def get_user_id(user_id: str = Query(...)) -> str:
    return user_id


# --- Fuel Fills ---

@router.get("/fuel-fills", response_model=list[FuelFillResponse])
def list_fuel_fills(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    return db.query(FuelFill).filter(FuelFill.user_id == user_id).order_by(FuelFill.date.desc()).all()


@router.post("/fuel-fills", response_model=FuelFillResponse, status_code=201)
def create_fuel_fill(payload: FuelFillCreate, db: Session = Depends(get_db)):
    fill = FuelFill(**payload.model_dump())
    db.add(fill)
    db.commit()
    db.refresh(fill)
    return fill


@router.put("/fuel-fills/{id}", response_model=FuelFillResponse)
def update_fuel_fill(id: str, payload: FuelFillUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    fill = db.query(FuelFill).filter(FuelFill.id == id, FuelFill.user_id == user_id).first()
    if not fill:
        raise HTTPException(status_code=404, detail="Fuel fill not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(fill, key, value)
    db.commit()
    db.refresh(fill)
    return fill


@router.delete("/fuel-fills/{id}", status_code=204)
def delete_fuel_fill(id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    fill = db.query(FuelFill).filter(FuelFill.id == id, FuelFill.user_id == user_id).first()
    if not fill:
        raise HTTPException(status_code=404, detail="Fuel fill not found")
    db.delete(fill)
    db.commit()


# --- Maintenance Logs ---

@router.get("/maintenance", response_model=list[MaintenanceLogResponse])
def list_maintenance_logs(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    return db.query(MaintenanceLog).filter(MaintenanceLog.user_id == user_id).order_by(MaintenanceLog.date.desc()).all()


@router.post("/maintenance", response_model=MaintenanceLogResponse, status_code=201)
def create_maintenance_log(payload: MaintenanceLogCreate, db: Session = Depends(get_db)):
    log = MaintenanceLog(**payload.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.put("/maintenance/{id}", response_model=MaintenanceLogResponse)
def update_maintenance_log(id: str, payload: MaintenanceLogUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    log = db.query(MaintenanceLog).filter(MaintenanceLog.id == id, MaintenanceLog.user_id == user_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Maintenance log not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(log, key, value)
    db.commit()
    db.refresh(log)
    return log


@router.delete("/maintenance/{id}", status_code=204)
def delete_maintenance_log(id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    log = db.query(MaintenanceLog).filter(MaintenanceLog.id == id, MaintenanceLog.user_id == user_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Maintenance log not found")
    db.delete(log)
    db.commit()


# --- Vehicles ---

@router.get("/vehicles", response_model=list[str])
def list_vehicles(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    fuel_vehicles = db.query(FuelFill.vehicle).filter(FuelFill.user_id == user_id).distinct().all()
    maint_vehicles = db.query(MaintenanceLog.vehicle).filter(MaintenanceLog.user_id == user_id).distinct().all()
    vehicles = set(v[0] for v in fuel_vehicles) | set(v[0] for v in maint_vehicles)
    return sorted(vehicles)


@router.get("/vehicles/{vehicle}/mileage")
def get_vehicle_mileage(vehicle: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    fills = db.query(FuelFill).filter(
        FuelFill.user_id == user_id,
        FuelFill.vehicle == vehicle
    ).order_by(FuelFill.odometer.asc()).all()

    if len(fills) < 2:
        return {"vehicle": vehicle, "fills": [], "message": "Not enough data to compute mileage"}

    mileage_data = []
    for i in range(1, len(fills)):
        prev = fills[i - 1]
        curr = fills[i]
        distance = curr.odometer - prev.odometer
        mileage = round(distance / curr.liters, 2) if curr.liters > 0 else 0
        mileage_data.append({
            "fill_id": curr.id,
            "date": curr.date,
            "odometer": curr.odometer,
            "liters": curr.liters,
            "distance_from_last": distance,
            "mileage_kmpl": mileage,
        })

    return {"vehicle": vehicle, "fills": mileage_data}
