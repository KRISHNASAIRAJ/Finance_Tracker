import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Car, Fuel, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useDeleteFuelFill,
  useFuelFills,
  useUpsertFuelFill,
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
  paiseToRupeesDetailed,
  parseRupees,
  rupeesToPaise,
} from '../../lib/format'
import { fromInputDate, toInputDate } from '../../lib/istDate'
import { toast } from '../../components/ui/Toast'
import type { FuelFill, Vehicle } from '../../types'

export function FuelFillsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: fills, isLoading } = useFuelFills(userId)
  const { data: vehicles } = useVehicles(userId)
  const deleteFill = useDeleteFuelFill(userId)

  const [vehicle, setVehicle] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = useMemo(
    () => (fills ?? []).filter((f) => !vehicle || f.vehicle === vehicle),
    [fills, vehicle]
  )

  const doDelete = async () => {
    if (!deleting) return
    try {
      await deleteFill.mutateAsync(deleting)
      toast.success('Fuel fill deleted')
    } catch {
      toast.error('Failed to delete fuel fill')
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
        title="Fuel fills"
        subtitle={`${filtered.length} fills recorded`}
        action={
          <Link to="/garage/fuel/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add fill
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
          icon={Fuel}
          title="No fuel fills"
          subtitle="Record your first fuel fill to start tracking mileage"
          action={
            <Link to="/garage/fuel/new">
              <Button variant="secondary" size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Add fill
              </Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <div className="px-5">
            <div className="hidden grid-cols-[1.4fr_0.7fr_0.9fr_0.8fr_1fr_auto] gap-3 border-b border-white/10 py-3 text-[11px] uppercase tracking-wide text-white/35 md:grid">
              <span>Vehicle</span>
              <span>Liters</span>
              <span>Price/L</span>
              <span>Odometer</span>
              <span>Amount</span>
              <span />
            </div>
            {filtered.map((f) => (
              <div
                key={f.id}
                className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/5 py-3 last:border-0 md:grid-cols-[1.4fr_0.7fr_0.9fr_0.8fr_1fr_auto]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/80">{f.vehicle}</p>
                  <p className="text-xs text-white/35">
                    {formatDate(f.date)} · {f.liters} L · {f.odometer} km
                  </p>
                </div>
                <p className="hidden text-sm text-white/70 tnum md:block">{f.liters} L</p>
                <p className="hidden text-sm text-white/70 tnum md:block">{paiseToRupeesDetailed(f.price_per_liter)}</p>
                <p className="hidden text-sm text-white/70 tnum md:block">{f.odometer} km</p>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-sm font-semibold text-white tnum">{paiseToRupees(f.amount)}</span>
                  <div className="flex gap-1">
                    <Link to={`/garage/fuel/${f.id}/edit`} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white">
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <button onClick={() => setDeleting(f.id)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]">
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
        title="Delete fuel fill"
        message="This fuel fill record will be removed."
        loading={deleteFill.isPending}
      />
    </div>
  )
}

export function FuelFillFormPage() {
  const { id } = useParams()
  return <FuelFillForm id={id} />
}

function FuelFillForm({ id }: { id?: string }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const navigate = useNavigate()
  const { data: fills, isLoading: fillsLoading } = useFuelFills(userId)
  const { data: vehicles, isLoading: vehiclesLoading } = useVehicles(userId)
  const upsertFill = useUpsertFuelFill(userId)

  const existing = id ? (fills ?? []).find((f) => f.id === id) : undefined

  if (fillsLoading || vehiclesLoading) return <LoadingSpinner />

  if ((vehicles ?? []).length === 0) {
    return (
      <div className="fade-up space-y-5">
        <PageHeader title={existing ? 'Edit fuel fill' : 'Add fuel fill'} />
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
        <PageHeader title="Fuel fill" />
        <EmptyState
          icon={Fuel}
          title="Fuel fill not found"
          action={
            <Link to="/garage/fuel">
              <Button variant="secondary" size="sm">Back to fills</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="fade-up mx-auto max-w-lg space-y-5">
      <PageHeader
        title={existing ? 'Edit fuel fill' : 'Add fuel fill'}
        subtitle={existing ? 'Update this fuel fill' : 'Record a fuel fill to track mileage'}
      />
      <FuelFillFields
        key={existing?.id ?? 'new'}
        existing={existing}
        vehicles={vehicles ?? []}
        upsert={upsertFill}
        navigate={navigate}
      />
    </div>
  )
}

function FuelFillFields({
  existing,
  vehicles,
  upsert,
  navigate,
}: {
  existing?: FuelFill
  vehicles: Vehicle[]
  upsert: ReturnType<typeof useUpsertFuelFill>
  navigate: ReturnType<typeof useNavigate>
}) {
  const [vehicle, setVehicle] = useState(existing?.vehicle ?? vehicles[0]?.name ?? '')
  const [date, setDate] = useState(existing ? toInputDate(existing.date) : toInputDate(new Date().toISOString()))
  const [amount, setAmount] = useState(existing ? String(existing.amount / 100) : '')
  const [liters, setLiters] = useState(existing ? String(existing.liters) : '')
  const [pricePerLiter, setPricePerLiter] = useState(existing ? String(existing.price_per_liter / 100) : '')
  const [odometer, setOdometer] = useState(existing ? String(existing.odometer) : '')
  const [station, setStation] = useState(existing?.station ?? '')
  const [note, setNote] = useState(existing?.note ?? '')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!vehicle) {
      toast.error('Select a vehicle')
      return
    }
    const paise = rupeesToPaise(parseRupees(amount))
    const pricePaise = rupeesToPaise(parseRupees(pricePerLiter))
    const litersNum = parseFloat(liters)
    const odoNum = parseFloat(odometer)
    if (paise <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (Number.isNaN(litersNum) || litersNum <= 0) {
      toast.error('Enter valid liters')
      return
    }
    if (pricePaise <= 0) {
      toast.error('Enter a valid price per liter')
      return
    }
    if (Number.isNaN(odoNum) || odoNum < 0) {
      toast.error('Enter a valid odometer reading')
      return
    }
    try {
      const row: Partial<FuelFill> = {
        vehicle,
        date: fromInputDate(date),
        amount: paise,
        liters: litersNum,
        price_per_liter: pricePaise,
        odometer: odoNum,
        station: station.trim() || null,
        note: note.trim() || null,
      }
      if (existing) {
        await upsert.mutateAsync({ id: existing.id, row })
        toast.success('Fuel fill updated')
      } else {
        await upsert.mutateAsync({ row })
        toast.success('Fuel fill added')
      }
      navigate('/garage/fuel')
    } catch {
      toast.error('Failed to save fuel fill')
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
          label="Liters"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={liters}
          onChange={(e) => setLiters(e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field.Input
          label="Price per liter (₹)"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={pricePerLiter}
          onChange={(e) => setPricePerLiter(e.target.value)}
          required
        />
        <Field.Input
          label="Odometer (km)"
          type="number"
          step="1"
          min="0"
          placeholder="0"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          required
        />
      </div>
      <Field.Input
        label="Station (optional)"
        placeholder="e.g. HPCL Kondapur"
        value={station}
        onChange={(e) => setStation(e.target.value)}
      />
      <Field.Input
        label="Note (optional)"
        placeholder="e.g. Traffic was heavy"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-3">
        <Button type="submit" className="flex-1" loading={upsert.isPending}>
          {existing ? 'Save changes' : 'Add fuel fill'}
        </Button>
        <Link to="/garage/fuel" className="flex-1">
          <Button type="button" variant="secondary" className="w-full">Cancel</Button>
        </Link>
      </div>
    </form>
  )
}
