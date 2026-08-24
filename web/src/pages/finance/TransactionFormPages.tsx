/**
 * AddExpensePage / EditTransactionPage — shared transaction form.
 */
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
} from '../../hooks/data/useTransactions'
import { PageHeader } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../lib/categoryMap'
import { fromInputDate, toInputDate } from '../../lib/istDate'
import { parseRupees, rupeesToPaise } from '../../lib/format'
import { toast } from '../../components/ui/Toast'
import type { Transaction } from '../../types'

const PAYMENT_MODES = [
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
]

export function AddExpensePage() {
  return <TransactionForm />
}

export function EditTransactionPage() {
  const { id } = useParams()
  return <TransactionForm id={id} />
}

function TransactionForm({ id }: { id?: string }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()

  const { data: txns } = useTransactions(userId)
  const createTxn = useCreateTransaction(userId)
  const updateTxn = useUpdateTransaction(userId)

  const existing = id ? (txns ?? []).find((t) => t.id === id) : undefined

  const [type, setType] = useState<'expense' | 'income'>(existing?.type === 'income' ? 'income' : 'expense')
  const [category, setCategory] = useState(existing?.category ?? 'Food & Dining')
  const [amount, setAmount] = useState(existing ? String(existing.amount / 100) : '')
  const [date, setDate] = useState(existing ? toInputDate(existing.date) : toInputDate(new Date().toISOString()))
  const [paymentMode, setPaymentMode] = useState(existing?.payment_mode ?? 'upi')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const paise = rupeesToPaise(parseRupees(amount))
    if (!paise || paise <= 0) {
      setError('Enter a valid amount')
      return
    }
    setError('')
    setSaving(true)
    const row: Partial<Transaction> = {
      type,
      amount: paise,
      currency: 'INR',
      category,
      date: fromInputDate(date),
      source: existing?.source ?? 'manual',
      payment_mode: paymentMode,
      notes: notes.trim() || null,
    }
    try {
      if (existing) {
        await updateTxn.mutateAsync({ id: existing.id, row })
        toast.success('Transaction updated')
      } else {
        await createTxn.mutateAsync({ row })
        toast.success('Transaction added')
      }
      navigate('/finance/transactions')
    } catch {
      toast.error('Failed to save transaction')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fade-up mx-auto max-w-lg space-y-5">
      <PageHeader
        title={existing ? 'Edit transaction' : 'Add transaction'}
        subtitle={existing ? 'Update this transaction' : 'Record an expense or income'}
      />

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 p-1">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); setCategory(t === 'expense' ? 'Food & Dining' : 'Salary') }}
              className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                type === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {t === 'expense' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>

        <Field.Input
          label="Amount (₹)"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-white/60">Category</label>
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {categories.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setCategory(c.name)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                  category === c.name
                    ? 'border-white/35 bg-white/10 text-white'
                    : 'border-white/10 text-white/50 hover:border-white/25'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field.Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Field.Select
            label="Payment mode"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            options={PAYMENT_MODES}
          />
        </div>

        <Field.Input
          label="Notes (optional)"
          placeholder="What was this for?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && <p className="text-sm text-[#FF887D]">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" className="flex-1" loading={saving}>
            {existing ? 'Save changes' : 'Add transaction'}
          </Button>
          <Link to="/finance/transactions" className="flex-1">
            <Button type="button" variant="secondary" className="w-full">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}