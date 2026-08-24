import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  Car,
  ChevronRight,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Wrench,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  useDeleteVehicle,
  useFuelFills,
  useMaintenanceLogs,
  useUpsertVehicle,
  useVehicles,
} from '../../hooks/data/useGarage'
import { EmptyState, PageHeader, Skeleton, StatCard } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Field } from '../../components/ui/Field'
import {
  formatDate,
  formatNumber,
  paiseToRupees,
  paiseToRupeesCompact,
  paiseToRupeesDetailed,
} from '../../lib/format'
import { toast } from '../../components/ui/Toast'
import type { Vehicle } from '../../types'

export function GarageDashboardPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: vehicles, isLoading: vehiclesLoading } = useVehicles(userId)
  const { data: fills } = useFuelFills(userId)
  const { data: maintenance } = useMaintenanceLogs(userId)
  const upsertVehicle = useUpsertVehicle(userId)
  const deleteVehicle = useDeleteVehicle(userId)

  const vehicleList = vehicles ?? []
  const [selected, setSelected] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [name, setName] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [deleting, setDeleting] = useState<Vehicle | null>(null)
  const [saving, setSaving] = useState(false)

  const active = vehicleList.find((v) => v.name === selected) ?? vehicleList[0]

  const vehicleFills = useMemo(
    () => (fills ?? []).filter((f) => f.vehicle === active?.name),
    [fills, active]
  )
  const vehicleMaintenance = useMemo(
    () => (maintenance ?? []).filter((m) => m.vehicle === active?.name),
    [maintenance, active]
  )

  const totalFuelSpend = vehicleFills.reduce((s, f) => s + f.amount, 0)
  const totalMaintenanceSpend = vehicleMaintenance.reduce((s, m) => s + m.amount, 0)
  const totalSpend = totalFuelSpend + totalMaintenanceSpend
  const latestOdometer = vehicleFills.reduce((max, f) => Math.max(max, f.odometer), 0)

  const mileage = useMemo(() => {
    const sorted = [...vehicleFills].sort((a, b) => a.odometer - b.odometer)
    if (sorted.length < 2) return null
    const latest = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    const dist = latest.odometer - prev.odometer
    if (dist <= 0 || latest.liters <= 0) return null
    return dist / latest.liters
  }, [vehicleFills])

  const openManage = () => {
    setFormOpen(false)
    setEditingVehicle(null)
    setManageOpen(true)
  }

  const openAddVehicle = () => {
    setEditingVehicle(null)
    setName('')
    setMake('')
    setModel('')
    setYear('')
    setFormOpen(true)
  }

  const openEditVehicle = (v: Vehicle) => {
    setEditingVehicle(v)
    setName(v.name)
    setMake(v.make ?? '')
    setModel(v.model ?? '')
    setYear(v.year ? String(v.year) : '')
    setFormOpen(true)
  }

  const saveVehicle = async () => {
    if (!name.trim()) {
      toast.error('Vehicle name required')
      return
    }
    setSaving(true)
    try {
      const row = {
        name: name.trim(),
        make: make.trim() || null,
        model: model.trim() || null,
        year: year.trim() ? Number(year.trim()) : null,
      }
      if (editingVehicle) {
        await upsertVehicle.mutateAsync({ id: editingVehicle.id, row })
        toast.success('Vehicle updated')
      } else {
        await upsertVehicle.mutateAsync({ row })
        toast.success('Vehicle added')
      }
      setFormOpen(false)
      setSelected(row.name)
    } catch {
      toast.error('Failed to save vehicle')
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    if (!deleting) return
    try {
      await deleteVehicle.mutateAsync(deleting.id)
      toast.success('Vehicle deleted')
      if (selected === deleting.name) setSelected(null)
    } catch {
      toast.error('Failed to delete vehicle')
    }
    setDeleting(null)
  }

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Garage"
        subtitle={
          active
            ? `${paiseToRupeesCompact(totalSpend)} spent across ${vehicleFills.length} fuel fills and ${vehicleMaintenance.length} services`
            : 'Track fuel, maintenance and mileage for your vehicles'
        }
      />

      {vehiclesLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : vehicleList.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No vehicles yet"
          subtitle="Add a vehicle to start tracking fuel fills and maintenance"
          action={<Button onClick={openManage}>Add vehicle</Button>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {vehicleList.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelected(v.name)}
                className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${
                  v.name === active?.name
                    ? 'bg-white text-black'
                    : 'border border-white/15 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {v.name}
              </button>
            ))}
            <button
              onClick={openManage}
              className="flex h-9 items-center gap-1.5 rounded-full border border-white/15 px-4 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Settings2 className="h-3.5 w-3.5" /> Manage
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/garage/fuel/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Add fuel fill
              </Button>
            </Link>
            <Link to="/garage/maintenance/new">
              <Button variant="secondary" size="sm" className="gap-1.5">
                <Wrench className="h-4 w-4" /> Add maintenance
              </Button>
            </Link>
            <Link to="/garage/reports">
              <Button variant="secondary" size="sm" className="gap-1.5">
                <BarChart3 className="h-4 w-4" /> View reports
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total fuel spend" value={paiseToRupeesCompact(totalFuelSpend)} />
            <StatCard label="Total maintenance" value={paiseToRupeesCompact(totalMaintenanceSpend)} />
            <StatCard label="Total distance" value={`${formatNumber(latestOdometer, 0)} km`} />
            <StatCard
              label="Mileage"
              value={mileage ? `${mileage.toFixed(1)} km/l` : '—'}
              changeLabel={mileage ? 'last fill' : 'need 2+ fills'}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Recent fuel fills"
                action={
                  <Link to="/garage/fuel" className="flex items-center gap-1 text-xs text-white/40 hover:text-white">
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              <CardBody>
                {vehicleFills.length === 0 && (
                  <p className="py-4 text-center text-sm text-white/30">No fuel fills</p>
                )}
                {vehicleFills.slice(0, 5).map((f) => (
                  <div key={f.id} className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/80">
                        {f.liters} L · {paiseToRupeesDetailed(f.price_per_liter)}/L
                      </p>
                      <p className="text-xs text-white/35">
                        {formatDate(f.date)} · {f.odometer} km
                      </p>
                    </div>
                    <span className="text-sm font-medium text-white tnum">{paiseToRupees(f.amount)}</span>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Recent maintenance"
                action={
                  <Link to="/garage/maintenance" className="flex items-center gap-1 text-xs text-white/40 hover:text-white">
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              <CardBody>
                {vehicleMaintenance.length === 0 && (
                  <p className="py-4 text-center text-sm text-white/30">No maintenance logs</p>
                )}
                {vehicleMaintenance.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/80">{m.service_type}</p>
                      <p className="text-xs text-white/35">
                        {formatDate(m.date)}
                        {m.odometer ? ` · ${m.odometer} km` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-white tnum">{paiseToRupees(m.amount)}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </>
      )}

      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title={formOpen ? (editingVehicle ? 'Edit vehicle' : 'Add vehicle') : 'Manage vehicles'}
        subtitle={formOpen ? 'Update the vehicle details' : undefined}
        footer={
          formOpen ? (
            <>
              <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={saveVehicle} loading={saving}>{editingVehicle ? 'Save' : 'Add'}</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setManageOpen(false)}>Close</Button>
          )
        }
      >
        {formOpen ? (
          <div className="space-y-4">
            <Field.Input
              label="Vehicle name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jupiter 125"
            />
            <div className="grid grid-cols-2 gap-4">
              <Field.Input
                label="Make"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="e.g. TVS"
              />
              <Field.Input
                label="Model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Jupiter"
              />
            </div>
            <Field.Input
              label="Year"
              type="number"
              step="1"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 2022"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Button variant="secondary" size="sm" className="w-full" onClick={openAddVehicle}>
              <Plus className="h-4 w-4" /> Add vehicle
            </Button>
            {vehicleList.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/80">{v.name}</p>
                  <p className="text-xs text-white/35">
                    {[v.make, v.model, v.year].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditVehicle(v)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleting(v)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-[#FF887D]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete vehicle"
        message={`Delete "${deleting?.name ?? ''}"? Fuel fills and maintenance logs for this vehicle will be kept.`}
        loading={deleteVehicle.isPending}
      />
    </div>
  )
}
