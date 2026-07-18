from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models import Transaction, CreditCard, BankAccount, Receivable, FixedExpense
from app.schemas import (
    TransactionCreate, TransactionUpdate, TransactionResponse,
    CreditCardCreate, CreditCardUpdate, CreditCardResponse,
    BankAccountCreate, BankAccountUpdate, BankAccountResponse,
    ReceivableCreate, ReceivableUpdate, ReceivableResponse,
    FixedExpenseCreate, FixedExpenseUpdate, FixedExpenseResponse,
    FinanceSummaryResponse,
)

router = APIRouter(prefix="/finance", tags=["finance"])


def get_user_id(user_id: str = Query(...)) -> str:
    return user_id


# --- Transactions ---

@router.get("/transactions", response_model=list[TransactionResponse])
def list_transactions(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    return db.query(Transaction).filter(Transaction.user_id == user_id).all()


@router.post("/transactions", response_model=TransactionResponse, status_code=201)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db)):
    txn = Transaction(**payload.model_dump())
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@router.put("/transactions/{id}", response_model=TransactionResponse)
def update_transaction(id: str, payload: TransactionUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == id, Transaction.user_id == user_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(txn, key, value)
    db.commit()
    db.refresh(txn)
    return txn


@router.delete("/transactions/{id}", status_code=204)
def delete_transaction(id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == id, Transaction.user_id == user_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(txn)
    db.commit()


# --- Credit Cards ---

@router.get("/credit-cards", response_model=list[CreditCardResponse])
def list_credit_cards(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    return db.query(CreditCard).filter(CreditCard.user_id == user_id).all()


@router.post("/credit-cards", response_model=CreditCardResponse, status_code=201)
def create_credit_card(payload: CreditCardCreate, db: Session = Depends(get_db)):
    card = CreditCard(**payload.model_dump())
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


@router.put("/credit-cards/{id}", response_model=CreditCardResponse)
def update_credit_card(id: str, payload: CreditCardUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    card = db.query(CreditCard).filter(CreditCard.id == id, CreditCard.user_id == user_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(card, key, value)
    db.commit()
    db.refresh(card)
    return card


@router.delete("/credit-cards/{id}", status_code=204)
def delete_credit_card(id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    card = db.query(CreditCard).filter(CreditCard.id == id, CreditCard.user_id == user_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found")
    db.delete(card)
    db.commit()


# --- Bank Accounts ---

@router.get("/bank-accounts", response_model=list[BankAccountResponse])
def list_bank_accounts(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    return db.query(BankAccount).filter(BankAccount.user_id == user_id).all()


@router.post("/bank-accounts", response_model=BankAccountResponse, status_code=201)
def create_bank_account(payload: BankAccountCreate, db: Session = Depends(get_db)):
    account = BankAccount(**payload.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.put("/bank-accounts/{id}", response_model=BankAccountResponse)
def update_bank_account(id: str, payload: BankAccountUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    account = db.query(BankAccount).filter(BankAccount.id == id, BankAccount.user_id == user_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(account, key, value)
    db.commit()
    db.refresh(account)
    return account


# --- Receivables ---

@router.get("/receivables", response_model=list[ReceivableResponse])
def list_receivables(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    return db.query(Receivable).filter(Receivable.user_id == user_id).all()


@router.post("/receivables", response_model=ReceivableResponse, status_code=201)
def create_receivable(payload: ReceivableCreate, db: Session = Depends(get_db)):
    recv = Receivable(**payload.model_dump())
    db.add(recv)
    db.commit()
    db.refresh(recv)
    return recv


@router.put("/receivables/{id}", response_model=ReceivableResponse)
def update_receivable(id: str, payload: ReceivableUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    recv = db.query(Receivable).filter(Receivable.id == id, Receivable.user_id == user_id).first()
    if not recv:
        raise HTTPException(status_code=404, detail="Receivable not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(recv, key, value)
    db.commit()
    db.refresh(recv)
    return recv


@router.delete("/receivables/{id}", status_code=204)
def delete_receivable(id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    recv = db.query(Receivable).filter(Receivable.id == id, Receivable.user_id == user_id).first()
    if not recv:
        raise HTTPException(status_code=404, detail="Receivable not found")
    db.delete(recv)
    db.commit()


# --- Fixed Expenses ---

@router.get("/fixed-expenses", response_model=list[FixedExpenseResponse])
def list_fixed_expenses(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    return db.query(FixedExpense).filter(FixedExpense.user_id == user_id).all()


@router.post("/fixed-expenses", response_model=FixedExpenseResponse, status_code=201)
def create_fixed_expense(payload: FixedExpenseCreate, db: Session = Depends(get_db)):
    fe = FixedExpense(**payload.model_dump())
    db.add(fe)
    db.commit()
    db.refresh(fe)
    return fe


@router.put("/fixed-expenses/{id}", response_model=FixedExpenseResponse)
def update_fixed_expense(id: str, payload: FixedExpenseUpdate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    fe = db.query(FixedExpense).filter(FixedExpense.id == id, FixedExpense.user_id == user_id).first()
    if not fe:
        raise HTTPException(status_code=404, detail="Fixed expense not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(fe, key, value)
    db.commit()
    db.refresh(fe)
    return fe


@router.delete("/fixed-expenses/{id}", status_code=204)
def delete_fixed_expense(id: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    fe = db.query(FixedExpense).filter(FixedExpense.id == id, FixedExpense.user_id == user_id).first()
    if not fe:
        raise HTTPException(status_code=404, detail="Fixed expense not found")
    db.delete(fe)
    db.commit()


# --- Summary ---

@router.get("/summary", response_model=FinanceSummaryResponse)
def get_summary(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    accounts = db.query(BankAccount).filter(BankAccount.user_id == user_id).all()
    total_balance = sum(a.amount for a in accounts)

    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")

    txns = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.date.like(f"{current_month}%")
    ).all()

    monthly_income = sum(t.amount for t in txns if t.type == "income")
    monthly_expenses = sum(t.amount for t in txns if t.type == "expense")

    return FinanceSummaryResponse(
        total_balance=total_balance,
        monthly_income=monthly_income,
        monthly_expenses=monthly_expenses,
    )
