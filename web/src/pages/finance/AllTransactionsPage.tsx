/**
 * AllTransactionsPage — list + filter + search all transactions.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Filter, Plus, Search, Trash2, Pencil } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTransactions, useDeleteTransaction } from '../../hooks/data/useTransactions'
import { PageHeader, EmptyState, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/Modal'
import { getCategoryIcon } from '../../lib/categoryMap'
import { formatDate, paiseToRupees } from '../../lib/format'
import { toast } from '../../components/ui/Toast'

export function AllTransactionsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: txns, isLoading } = useTransactions(userId)
  const deleteTxn = useDeleteTransaction(userId)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = txns ?? []
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((t) => t.category.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q))
    }
    if (typeFilter === 'expense') list = list.filter((t) => t.type !== 'income')
    else if (typeFilter === 'income') list = list.filter((t) => t.type === 'income')
    return list
  }, [txns, search, typeFilter])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteTxn.mutateAsync(deleteId)
      toast.success('Transaction deleted')
    } catch {
      toast.error('Failed to delete')
    }
    setDeleteId(null)
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="All transactions"
        subtitle={`${txns?.length ?? 0} total`}
        action={
          <Link to="/finance/transactions/new">
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add</Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions..."
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-white/35 focus:outline-none"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-white/10 p-1">
          {(['all', 'expense', 'income'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {t === 'all' ? 'All' : t === 'expense' ? 'Expenses' : 'Income'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No transactions found"
          subtitle={search ? 'Try a different search' : 'Add your first expense'}
          action={
            <Link to="/finance/transactions/new">
              <Button variant="secondary" size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add expense</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <div className="divide-y divide-white/5">
            {filtered.map((t) => {
              const CatIcon = getCategoryIcon(t.category)
              const isOut = t.type !== 'income'
              return (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors group">
                  <CatIcon className="h-4 w-4 shrink-0 text-white/30" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white/90">{t.category}</p>
                    <p className="text-xs text-white/40">{formatDate(t.date)}{t.notes ? ` · ${t.notes}` : ''}</p>
                  </div>
                  <span className={`text-sm font-semibold tnum ${isOut ? 'text-white' : 'text-[#59D6C7]'}`}>
                    {isOut ? '−' : '+'}
                    {paiseToRupees(t.amount)}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link to={`/finance/transactions/${t.id}/edit`} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white">
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      onClick={() => setDeleteId(t.id)}
                      className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete transaction"
        message="This cannot be undone. The transaction will be permanently removed."
        loading={deleteTxn.isPending}
      />
    </div>
  )
}