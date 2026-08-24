import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Car, Pencil, Plus, Trash2, Wrench } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useDeleteMaintenance,
  useMaintenanceLogs,
  useUpsertMaintenance,
  useVehicles,
} from '../../hooks/data/useGarage'
import { EmptyState, LoadingSpinner, PageHeader, Skeleton } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import {
  formatDate,
  paiseToRupees,
  parseRupees,
  rupeesToPaise,
} from '../../lib/format'
import { fromInputDate, toInputDate } from '../../lib/istDate'
import { toast } from '../../components/ui/Toast'
import type { MaintenanceLog, Vehicle } from '../../types'

export function MaintenancePage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: maintenance, isLoading } = useMaintenanceLogs(userId)
  const { data: vehicles } = useVehicles(userId)
  const deleteMaintenance = useDeleteMaintenance(userId)

  const [vehicle, setVehicle] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = useMemo(
    () => (maintenance ?? []).filter((m) => !vehicle || m.vehicle === vehicle),
    [maintenance, vehicle]
  )

  const doDelete = async () => {
    if (!deleting) return
    try {
      await deleteMaintenance.mutateAsync(deleting)
      toast.success('Maintenance log deleted')
    } catch {
      toast.error('Failed to delete maintenance log')
    }
    setDeleting(null)
  }

  const vehicleOptions = [
    { value: '', label: 'All vehicles' },
    ...(vehicles ?? []).map((v) => ({ value: v.name, label: v.name })),
  ]

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Maintenance"
        subtitle={`${filtered.length} logs recorded`}
        action={
          <Link to="/garage/maintenance/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add maintenance
            </Button>
          </Link>
        }
      />

      {(vehicles ?? []).length > 1 && (
        <div className="max-w-xs">
          <Field.Select
            label="Vehicle"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            options={vehicleOptions}
          />
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No maintenance logs"
          subtitle="Record services, repairs and part replacements"
          action={
            <Link to="/garage/maintenance/new">
              <Button variant="secondary" size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Add maintenance
              </Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <div className="px-5">
            <div className="hidden grid-cols-[1.5fr_0.8fr_1fr_auto] gap-3 border-b border-white/10 py-3 text-[11px] uppercase tracking-wide text-white/35 md:grid">
              <span>Vehicle</span>
              <span>Odometer</span>
              <span>Amount</span>
              <span />
            </div>
            {filtered.map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/5 py-3 last:border-0 md:grid-cols-[1.5fr_0.8fr_1fr_auto]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/80">{m.vehicle}</p>
                  <p className="text-xs text-white/35">
                    {m.service_type} · {formatDate(m.date)}
                    {m.odometer ? ` · ${m.odometer} km` : ''}
                  </p>
                </div>
                <p className="hidden text-sm text-white/70 tnum md:block">
                  {m.odometer ? `${m.odometer} km` : '—'}
                </p>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-sm font-semibold text-white tnum">{paiseToRupees(m.amount)}</span>
                  <div className="flex gap-1">
                    <Link to={`/garage/maintenance/${m.id}/edit`} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white">
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <button onClick={() => setDeleting(m.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete maintenance log"
        message="This maintenance log will be removed."
        loading={deleteMaintenance.isPending}
      />
    </div>
  )
}

export function MaintenanceFormPage() {
  const { id } = useParams()
  return <MaintenanceForm id={id} />
}

function MaintenanceForm({ id }: { id?: string }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const { data: maintenance, isLoading: maintenanceLoading } = useMaintenanceLogs(userId)
  const { data: vehicles, isLoading: vehiclesLoading } = useVehicles(userId)
  const upsertMaintenance = useUpsertMaintenance(userId)

  const existing = id ? (maintenance ?? []).find((m) => m.id === id) : undefined

  if (maintenanceLoading || vehiclesLoading) return <LoadingSpinner />

  if ((vehicles ?? []).length === 0) {
    return (
      <div className="fade-up space-y-5">
        <PageHeader title={existing ? 'Edit maintenance' : 'Add maintenance'} />
        <EmptyState
          icon={Car}
          title="No vehicles yet"
          subtitle="Add a vehicle in the garage dashboard first"
          action={
            <Link to="/garage">
              <Button variant="secondary" size="sm">Go to garage</Button>
            </Link>
          }
        />
      </div>
    )
  }

  if (id && !existing) {
    return (
      <div className="fade-up space-y-5">
        <PageHeader title="Maintenance" />
        <EmptyState
          icon={Wrench}
          title="Maintenance log not found"
          action={
            <Link to="/garage/maintenance">
              <Button variant="secondary" size="sm">Back to maintenance</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="fade-up mx-auto max-w-lg space-y-5">
      <PageHeader
        title={existing ? 'Edit maintenance' : 'Add maintenance'}
        subtitle={existing ? 'Update this maintenance log' : 'Record a service or repair'}
      />
      <MaintenanceFields
        key={existing?.id ?? 'new'}
        existing={existing}
        vehicles={vehicles ?? []}
        upsert={upsertMaintenance}
        navigate={navigate}
      />
    </div>
  )
}

function MaintenanceFields({
  existing,
  vehicles,
  upsert,
  navigate,
}: {
  existing?: MaintenanceLog
  vehicles: Vehicle[]
  upsert: ReturnType<typeof useUpsertMaintenance>
  navigate: ReturnType<typeof useNavigate>
}) {
  const [vehicle, setVehicle] = useState(existing?.vehicle ?? vehicles[0]?.name ?? '')
  const [date, setDate] = useState(existing ? toInputDate(existing.date) : toInputDate(new Date().toISOString()))
  const [serviceType, setServiceType] = useState(existing?.service_type ?? '')
  const [amount, setAmount] = useState(existing ? String(existing.amount / 100) : '')
  const [odometer, setOdometer] = useState(existing?.odometer ? String(existing.odometer) : '')
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!vehicle) {
      toast.error('Select a vehicle')
      return
    }
    if (!serviceType.trim()) {
      toast.error('Enter a service type')
      return
    }
    const paise = rupeesToPaise(parseRupees(amount))
    if (paise <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    const odoNum = odometer.trim() ? parseFloat(odometer) : null
    if (odoNum !== null && (Number.isNaN(odoNum) || odoNum < 0)) {
      toast.error('Enter a valid odometer reading')
      return
    }
    try {
      const row: Partial<MaintenanceLog> = {
        vehicle,
        date: fromInputDate(date),
        amount: paise,
        service_type: serviceType.trim(),
        odometer: odoNum,
        notes: notes.trim() || null,
      }
      if (existing) {
        await upsert.mutateAsync({ id: existing.id, row })
        toast.success('Maintenance log updated')
      } else {
        await upsert.mutateAsync({ row })
        toast.success('Maintenance log added')
      }
      navigate('/garage/maintenance')
    } catch {
      toast.error('Failed to save maintenance log')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field.Select
          label="Vehicle"
          value={vehicle}
          onChange={(e) => setVehicle(e.target.value)}
          options={vehicles.map((v) => ({ value: v.name, label: v.name }))}
        />
        <Field.Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <Field.Input
        label="Service type"
        placeholder="e.g. Oil change, Tyre replacement"
        value={serviceType}
        onChange={(e) => setServiceType(e.target.value)}
        required
      />
      <div className="grid grid-cols-2 gap-4">
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
        <Field.Input
          label="Odometer (km, optional)"
          type="number"
          step="1"
          min="0"
          placeholder="0"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
        />
      </div>
      <Field.Input
        label="Notes (optional)"
        placeholder="e.g. Replaced brake pads"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex gap-3">
        <Button type="submit" className="flex-1" loading={upsert.isPending}>
          {existing ? 'Save changes' : 'Add maintenance'}
        </Button>
        <Link to="/garage/maintenance" className="flex-1">
          <Button type="button" variant="secondary" className="w-full">Cancel</Button>
        </Link>
      </div>
    </form>
  )
}
