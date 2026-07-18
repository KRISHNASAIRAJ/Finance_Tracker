from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class SyncPayload(BaseModel):
    entity: str
    action: str
    data: Dict[str, Any]


class SyncUploadRequest(BaseModel):
    payloads: List[SyncPayload]


class SyncDownloadRequest(BaseModel):
    last_sync: str


class SyncDownloadResponse(BaseModel):
    transactions: List[Dict[str, Any]] = []
    credit_cards: List[Dict[str, Any]] = []
    bank_accounts: List[Dict[str, Any]] = []
    receivables: List[Dict[str, Any]] = []
    fixed_expenses: List[Dict[str, Any]] = []
    fuel_fills: List[Dict[str, Any]] = []
    maintenance_logs: List[Dict[str, Any]] = []
    tasks: List[Dict[str, Any]] = []
    notes: List[Dict[str, Any]] = []
    goals: List[Dict[str, Any]] = []
    recipes: List[Dict[str, Any]] = []
    diet_plans: List[Dict[str, Any]] = []
    server_time: Optional[str] = None
