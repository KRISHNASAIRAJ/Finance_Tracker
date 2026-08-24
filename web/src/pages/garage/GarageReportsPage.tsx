import { useMemo, useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useFuelFills, useMaintenanceLogs, useVehicles } from '../../hooks/data/useGarage'
import { EmptyState, PageHeader, Skeleton, StatCard } from '../../components/ui/Shared'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Donut, TrendBars, TrendLine } from '../../components/charts/Charts'
import { getCategory } from '../../lib/categoryMap'
import { formatDate, formatMonthKey, formatNumber, paiseToRupeesCompact } from '../../lib/format'
import { istMonthKey } from '../../lib/istDate'

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function GarageReportsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: fills, isLoading: fillsLoading } = useFuelFills(userId)
  const { data: maintenance, isLoading: maintenanceLoading } = useMaintenanceLogs(userId)
  const { data: vehicles } = useVehicles(userId)

  const [month, setMonth] = useState(istMonthKey())
  const [mileageVehicle, setMileageVehicle] = useState('')

  const monthFills = useMemo(
    () => (fills ?? []).filter((f) => f.date.slice(0, 7) === month),
    [fills, month]
  )
  const monthMaintenance = useMemo(
    () => (maintenance ?? []).filter((m) => m.date.slice(0, 7) === month),
    [maintenance, month]
  )

  const fuelSpend = monthFills.reduce((s, f) => s + f.amount, 0)
  const maintenanceSpend = monthMaintenance.reduce((s, m) => s + m.amount, 0)
  const totalSpend = fuelSpend + maintenanceSpend

  const vehicleData = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of monthFills) map.set(f.vehicle, (map.get(f.vehicle) ?? 0) + f.amount)
    for (const m of monthMaintenance) map.set(m.vehicle, (map.get(m.vehicle) ?? 0) + m.amount)
    return Array.from(map.entries())
      .filter(([, value]) => value > 0)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
  }, [monthFills, monthMaintenance])

  const splitData = [
    { name: 'Fuel', value: fuelSpend, color: getCategory('Fuel').color },
    { name: 'Maintenance', value: maintenanceSpend, color: '#9BA5FF' },
  ].filter((d) => d.value > 0)

  const activeMileageVehicle = mileageVehicle || (vehicles ?? [])[0]?.name || ''

  const odometerData = useMemo(
    () =>
      monthFills
        .filter((f) => f.vehicle === activeMileageVehicle)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((f) => ({ label: formatDate(f.date), value: f.odometer })),
    [monthFills, activeMileageVehicle]
  )

  return (
    <div className="fade-up space-y-5">
      <PageHeader
        title="Garage reports"
        subtitle="Fuel and maintenance across all vehicles"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[110px] text-center text-sm font-semibold text-white">{formatMonthKey(month)}</p>
            <button
              onClick={() => setMonth(shiftMonth(month, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {fillsLoading || maintenanceLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : totalSpend === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No garage activity"
          subtitle="No fuel fills or maintenance for this month"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total garage spend" value={paiseToRupeesCompact(totalSpend)} />
            <StatCard
              label="Fuel spend"
              value={paiseToRupeesCompact(fuelSpend)}
              changeLabel={`${monthFills.length} fills`}
            />
            <StatCard
              label="Maintenance spend"
              value={paiseToRupeesCompact(maintenanceSpend)}
              changeLabel={`${monthMaintenance.length} services`}
            />
            <StatCard label="Entries" value={String(monthFills.length + monthMaintenance.length)} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Spend by vehicle" subtitle="Fuel + maintenance" />
              <CardBody>
                <TrendBars data={vehicleData} height={200} formatter={paiseToRupeesCompact} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Fuel vs maintenance" />
              <CardBody>
                <Donut data={splitData} height={200} formatter={paiseToRupeesCompact} centerLabel="Spend" />
                <div className="mt-3 space-y-1.5">
                  {splitData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="flex-1 truncate text-white/60">{d.name}</span>
                      <span className="font-medium text-white/80">{paiseToRupeesCompact(d.value)}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>

          {odometerData.length >= 2 && (
            <Card>
              <CardHeader
                title="Odometer trend"
                subtitle={`${activeMileageVehicle} · ${odometerData.length} readings`}
                action={
                  (vehicles ?? []).length > 1 ? (
                    <select
                      value={activeMileageVehicle}
                      onChange={(e) => setMileageVehicle(e.target.value)}
                      className="h-8 rounded-lg border border-white/10 bg-[#161616] px-2 text-xs text-white focus:outline-none"
                    >
                      {(vehicles ?? []).map((v) => (
                        <option key={v.id} value={v.name} className="bg-[#161616] text-white">
                          {v.name}
                        </option>
                      ))}
                    </select>
                  ) : undefined
                }
              />
              <CardBody>
                <TrendLine
                  data={odometerData}
                  height={180}
                  color="#BCE85D"
                  formatter={(v) => `${formatNumber(v, 0)} km`}
                />
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
