import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ProtectedRoute, PublicOnlyRoute } from './components/layout/ProtectedRoute'
import { ToastHost } from './components/ui/Toast'
import { ForgotPasswordPage, LoginPage, SignupPage } from './pages/auth/AuthPages'

import { HomePage } from './pages/HomePage'

// Finance
import { FinanceHomePage } from './pages/finance/FinanceHomePage'
import { AllTransactionsPage } from './pages/finance/AllTransactionsPage'
import { AddExpensePage, EditTransactionPage } from './pages/finance/TransactionFormPages'
import { BankAccountsPage } from './pages/finance/BankAccountsPage'
import { CreditCardsPage, CreditCardDetailPage } from './pages/finance/CreditCardsPage'
import { LentBorrowedPage } from './pages/finance/LentBorrowedPage'
import { FixedExpensesPage } from './pages/finance/FixedExpensesPage'
import { RecurringExpensesPage } from './pages/finance/RecurringExpensesPage'
import { MonthlySpendPage } from './pages/finance/MonthlySpendPage'
import { FinanceReportsPage } from './pages/finance/FinanceReportsPage'
import { PayzappWalletPage } from './pages/finance/PayzappWalletPage'
import { BalanceSummaryPage } from './pages/finance/BalanceSummaryPage'
import { CardAssistantPage, CardChatPage } from './pages/finance/CardAssistantPages'

// Garage
import { GarageDashboardPage } from './pages/garage/GarageDashboardPage'
import { FuelFillsPage, FuelFillFormPage } from './pages/garage/FuelFillsPage'
import { MaintenancePage, MaintenanceFormPage } from './pages/garage/MaintenancePage'
import { VehicleSpendPage } from './pages/garage/VehicleSpendPage'
import { GarageReportsPage } from './pages/garage/GarageReportsPage'

// Tasks
import { TasksDashboardPage } from './pages/tasks/TasksDashboardPage'
import { TaskDetailPage, TaskFormPage } from './pages/tasks/TaskPages'

// Wealth
import { WealthDashboardPage } from './pages/wealth/WealthDashboardPage'
import { HoldingsListPage, HoldingFormPage } from './pages/wealth/HoldingsPages'
import { GoalsPage, GoalFormPage } from './pages/wealth/GoalsPages'
import { PortfolioHistoryPage } from './pages/wealth/PortfolioHistoryPage'
import { AllocationDetailPage } from './pages/wealth/AllocationDetailPage'
import { AIRecommendationsPage } from './pages/wealth/AIRecommendationsPage'

// Personal / More
import { MoreMenuPage } from './pages/personal/MoreMenuPage'
import { CombinedReportPage } from './pages/personal/CombinedReportPage'
import { NotesPage } from './pages/personal/NotesPage'
import { GoalsTrackerPage } from './pages/personal/GoalsTrackerPage'
import { RecipesPage } from './pages/personal/RecipesPage'
import { DietViewerPage } from './pages/personal/DietViewerPage'

// Meals
import { MealLoggerPage } from './pages/meals/MealLoggerPage'
import { MealAISuggestionsPage } from './pages/meals/MealAISuggestionsPage'
import { WeightTrackerPage } from './pages/meals/WeightTrackerPage'

// Career
import { CareerTrackerPage, CareerEventFormPage } from './pages/career/CareerPages'

// Diary
import { WeeklyDiaryPage } from './pages/diary/WeeklyDiaryPage'

export default function App() {
  return (
    <>
      <Routes>
        {/* Public auth */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Protected app */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />

            {/* Finance */}
            <Route path="/finance" element={<FinanceHomePage />} />
            <Route path="/finance/transactions" element={<AllTransactionsPage />} />
            <Route path="/finance/transactions/new" element={<AddExpensePage />} />
            <Route path="/finance/transactions/:id/edit" element={<EditTransactionPage />} />
            <Route path="/finance/accounts" element={<BankAccountsPage />} />
            <Route path="/finance/cards" element={<CreditCardsPage />} />
            <Route path="/finance/cards/:id" element={<CreditCardDetailPage />} />
            <Route path="/finance/cards/:id/chat" element={<CardChatPage />} />
            <Route path="/finance/cards/assistant" element={<CardAssistantPage />} />
            <Route path="/finance/lent" element={<LentBorrowedPage />} />
            <Route path="/finance/fixed" element={<FixedExpensesPage />} />
            <Route path="/finance/recurring" element={<RecurringExpensesPage />} />
            <Route path="/finance/monthly" element={<MonthlySpendPage />} />
            <Route path="/finance/reports" element={<FinanceReportsPage />} />
            <Route path="/finance/payzapp" element={<PayzappWalletPage />} />
            <Route path="/finance/balance" element={<BalanceSummaryPage />} />

            {/* Garage */}
            <Route path="/garage" element={<GarageDashboardPage />} />
            <Route path="/garage/fuel" element={<FuelFillsPage />} />
            <Route path="/garage/fuel/new" element={<FuelFillFormPage />} />
            <Route path="/garage/fuel/:id/edit" element={<FuelFillFormPage />} />
            <Route path="/garage/maintenance" element={<MaintenancePage />} />
            <Route path="/garage/maintenance/new" element={<MaintenanceFormPage />} />
            <Route path="/garage/maintenance/:id/edit" element={<MaintenanceFormPage />} />
            <Route path="/garage/vehicle/:name" element={<VehicleSpendPage />} />
            <Route path="/garage/reports" element={<GarageReportsPage />} />

            {/* Tasks */}
            <Route path="/tasks" element={<TasksDashboardPage />} />
            <Route path="/tasks/new" element={<TaskFormPage />} />
            <Route path="/tasks/:id" element={<TaskDetailPage />} />
            <Route path="/tasks/:id/edit" element={<TaskFormPage />} />

            {/* Wealth */}
            <Route path="/wealth" element={<WealthDashboardPage />} />
            <Route path="/wealth/holdings" element={<HoldingsListPage />} />
            <Route path="/wealth/holdings/new" element={<HoldingFormPage />} />
            <Route path="/wealth/holdings/:id/edit" element={<HoldingFormPage />} />
            <Route path="/wealth/goals" element={<GoalsPage />} />
            <Route path="/wealth/goals/new" element={<GoalFormPage />} />
            <Route path="/wealth/goals/:id/edit" element={<GoalFormPage />} />
            <Route path="/wealth/history" element={<PortfolioHistoryPage />} />
            <Route path="/wealth/allocation/:cat" element={<AllocationDetailPage />} />
            <Route path="/wealth/ai" element={<AIRecommendationsPage />} />

            {/* Personal */}
            <Route path="/more" element={<MoreMenuPage />} />
            <Route path="/more/report" element={<CombinedReportPage />} />
            <Route path="/more/notes" element={<NotesPage />} />
            <Route path="/more/goals" element={<GoalsTrackerPage />} />
            <Route path="/more/recipes" element={<RecipesPage />} />
            <Route path="/more/diet" element={<DietViewerPage />} />

            {/* Meals */}
            <Route path="/meals" element={<MealLoggerPage />} />
            <Route path="/meals/ai" element={<MealAISuggestionsPage />} />
            <Route path="/meals/weight" element={<WeightTrackerPage />} />

            {/* Career */}
            <Route path="/career" element={<CareerTrackerPage />} />
            <Route path="/career/new" element={<CareerEventFormPage />} />
            <Route path="/career/:id/edit" element={<CareerEventFormPage />} />

            {/* Diary */}
            <Route path="/diary" element={<WeeklyDiaryPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
    </>
  )
}