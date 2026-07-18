from pydantic import BaseModel


class FinanceSummaryResponse(BaseModel):
    total_balance: int = 0
    monthly_income: int = 0
    monthly_expenses: int = 0
