/**
 * Chart wrappers — Recharts with the Tracend palette.
 */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const tooltipStyle = {
  backgroundColor: '#1A1A1A',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '12px',
  fontSize: '12px',
  color: '#fff',
}

function AxisTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={tooltipStyle} className="px-3 py-2 shadow-xl">
      <p className="mb-1 text-white/50">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.payload?.fill }}>
          {p.name}: {formatter ? formatter(p.value) : p.value.toLocaleString('en-IN')}
        </p>
      ))}
    </div>
  )
}

function PieTip({ active, payload, formatter }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={tooltipStyle} className="px-3 py-2 shadow-xl">
      <p style={{ color: p.payload?.fill }}>
        {p.name}: {formatter ? formatter(p.value) : p.value.toLocaleString('en-IN')}
      </p>
    </div>
  )
}

export interface SeriesPoint {
  label: string
  value: number
  [key: string]: unknown
}

export function TrendArea({
  data,
  xKey = 'label',
  yKey = 'value',
  color = '#59D6C7',
  height = 120,
  formatter,
}: {
  data: SeriesPoint[]
  xKey?: string
  yKey?: string
  color?: string
  height?: number
  formatter?: (v: number) => string
}) {
  const gid = `grad-${color.replace('#', '')}`
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey={xKey} hide />
        <YAxis hide domain={['auto', 'auto']} />
        <Tooltip content={<AxisTooltip formatter={formatter} />} />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gid})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function TrendBars({
  data,
  xKey = 'label',
  yKey = 'value',
  color = '#9BA5FF',
  height = 160,
  formatter,
}: {
  data: SeriesPoint[]
  xKey?: string
  yKey?: string
  color?: string
  height?: number
  formatter?: (v: number) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
        <XAxis dataKey={xKey} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip content={<AxisTooltip formatter={formatter} />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
        <Bar dataKey={yKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function Donut({
  data,
  height = 180,
  formatter,
  innerRadius = 55,
  outerRadius = 80,
  centerLabel,
}: {
  data: Array<{ name: string; value: number; color: string }>
  height?: number
  formatter?: (v: number) => string
  innerRadius?: number
  outerRadius?: number
  centerLabel?: string
}) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Tooltip content={<PieTip formatter={formatter} />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wider text-white/40">{centerLabel}</span>
        </div>
      )}
    </div>
  )
}

export function TrendLine({
  data,
  xKey = 'label',
  yKey = 'value',
  color = '#9BA5FF',
  height = 180,
  formatter,
}: {
  data: SeriesPoint[]
  xKey?: string
  yKey?: string
  color?: string
  height?: number
  formatter?: (v: number) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis hide domain={['auto', 'auto']} />
        <Tooltip content={<AxisTooltip formatter={formatter} />} />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color, strokeWidth: 0 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
