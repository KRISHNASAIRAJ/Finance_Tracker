import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Car } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useFuelFills, useMaintenanceLogs } from '../../hooks/data/useGarage'
import { EmptyState, PageHeader, Skeleton, StatCard } from '../../components/ui/Shared'
import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Donut } from '../../components/charts/Charts'
import { getCategory } from '../../lib/categoryMap'
import {
  formatDate,
  formatNumber,
  paiseToRupees,
  paiseToRupeesCompact,
  paiseToRupeesDetailed,
} from '../../lib/format'

const PALETTE = ['#9BA5FF', '#59D6C7', '#BCE85D', '#5EE6FF', '#D0BCFF', '#FFB2B9', '#E2A45C', '#F472B6', '#38BDF8', '#A78BFA']

export function VehicleSpendPage() {
  const { name } = useParams()
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: fills, isLoading: fillsLoading } = useFuelFills(userId)
  const { data: maintenance, isLoading: maintenanceLoading } = useMaintenanceLogs(userId)

  const vehicleFills = useMemo(
    () => (fills ?? []).filter((f) => f.vehicle === name),
    [fills, name]
  )
  const vehicleMaintenance = useMemo(
    () => (maintenance ?? []).filter((m) => m.vehicle === name),
    [maintenance, name]
  )

  const fuelSpend = vehicleFills.reduce((s, f) => s + f.amount, 0)
  const maintenanceSpend = vehicleMaintenance.reduce((s, m) => s + m.amount, 0)
  const totalSpend = fuelSpend + maintenanceSpend
  const totalLiters = vehicleFills.reduce((s, f) => s + f.liters, 0)
  const avgPricePerLiter = totalLiters > 0 ? Math.round(fuelSpend / totalLiters) : 0

  const donutData = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of vehicleFills) map.set('Fuel', (map.get('Fuel') ?? 0) + f.amount)
    for (const m of vehicleMaintenance) {
      map.set(m.service_type, (map.get(m.service_type) ?? 0) + m.amount)
    }
    let serviceIdx = 0
    return Array.from(map.entries())
      .map(([key, value]) => {
        if (key === 'Fuel') return { name: key, value, color: getCategory('Fuel').color }
        const color = PALETTE[serviceIdx % PALETTE.length]
        serviceIdx += 1
        return { name: key, value, color }
      })
      .sort((a, b) => b.value - a.value)
  }, [vehicleFills, vehicleMaintenance])

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title={name ?? 'Vehicle'}
        subtitle={
          name
            ? `${vehicleFills.length} fuel fills · ${vehicleMaintenance.length} maintenance logs`
            : 'Track spend for a single vehicle'
        }
        action={
          <Link to="/garage">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Garage
            </Button>
          </Link>
        }
      />

      {fillsLoading || maintenanceLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !name || (vehicleFills.length === 0 && vehicleMaintenance.length === 0) ? (
        <EmptyState
          icon={Car}
          title="No data for this vehicle"
          subtitle="Fuel fills and maintenance for this vehicle will appear here"
          action={
            <Link to="/garage">
              <Button variant="secondary" size="sm">Go to garage</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total spend" value={paiseToRupeesCompact(totalSpend)} />
            <StatCard
              label="Fuel spend"
              value={paiseToRupeesCompact(fuelSpend)}
              changeLabel={`${formatNumber(totalLiters, 1)} L · ${vehicleFills.length} fills`}
            />
            <StatCard
              label="Maintenance spend"
              value={paiseToRupeesCompact(maintenanceSpend)}
              changeLabel={`${vehicleMaintenance.length} services`}
            />
            <StatCard
              label="Avg price per liter"
              value={avgPricePerLiter > 0 ? paiseToRupeesDetailed(avgPricePerLiter) : '—'}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Spend breakdown" />
              <CardBody>
                {donutData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-white/30">No spend yet</p>
                ) : (
                  <>
                    <Donut data={donutData} height={180} formatter={paiseToRupeesCompact} />
                    <div className="mt-3 space-y-1.5">
                      {donutData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2 text-xs">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="flex-1 truncate text-white/60">{d.name}</span>
                          <span className="font-medium text-white/80">{paiseToRupeesCompact(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardBody>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title="Fuel fill history" subtitle={`${vehicleFills.length} fills`} />
              <CardBody>
                {vehicleFills.length === 0 && (
                  <p className="py-8 text-center text-sm text-white/30">No fuel fills</p>
                )}
                {vehicleFills.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/80">{formatDate(f.date)}</p>
                      <p className="text-xs text-white/35">
                        {f.liters} L · {paiseToRupeesDetailed(f.price_per_liter)}/L · {f.odometer} km
                      </p>
                    </div>
                    <span className="text-sm font-medium text-white tnum">{paiseToRupees(f.amount)}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Maintenance history"
              subtitle={`${vehicleMaintenance.length} logs`}
            />
            <CardBody>
              {vehicleMaintenance.length === 0 && (
                <p className="py-8 text-center text-sm text-white/30">No maintenance logs</p>
              )}
              {vehicleMaintenance.map((m) => (
                <div key={m.id} className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/80">{m.service_type}</p>
                    <p className="text-xs text-white/35">
                      {formatDate(m.date)}
                      {m.odometer ? ` · ${m.odometer} km` : ''}
                      {m.notes ? ` · ${m.notes}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-white tnum">{paiseToRupees(m.amount)}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
