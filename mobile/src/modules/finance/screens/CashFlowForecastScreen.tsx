/**
 * CashFlowForecastScreen — "Cash flow" (s35).
 *
 * Projects the balance over the next 14 / 30 / 60 days from real data only:
 *   banks + wallets (start), card statements due, unpaid fixed expenses and
 *   SIPs, lent money coming back, and the everyday-spend average over the
 *   last 30 days (SIPs, rent and wallet loads excluded).
 *
 * Meridian v2 layout. No sample numbers — an empty account set reads as ₹0.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useWindowDimensions } from 'react-native';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  Card,
  Label,
  PressScale,
  Rise,
  Screen,
  SegmentedControl,
  TopBar,
} from '../../../shared/components/meridian';
import { useFinanceStore, getMinBalanceForAccount } from '../store';
import {
  dayKeyRange,
  localDayKey,
  monthOfKey,
  shiftLocalDayKey,
  shortDayKey,
  formatRupees,
  formatCompact,
  dayOfKey,
} from '../financeFormat';
import {
  buildForecastEvents,
  computeAverageDailySpend,
  computeCashFlow,
  type ForecastEvent,
} from '../forecast';

const SPEND_OVERRIDE_KEY = 'meridian-cashflow-dailyspend';

const RANGE_OPTIONS = [
  { key: '14', label: '14 days' },
  { key: '30', label: '30 days' },
  { key: '60', label: '60 days' },
];

export default function CashFlowForecastScreen() {
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();

  const accounts = useFinanceStore((s) => s.accounts);
  const wallets = useFinanceStore((s) => s.wallets);
  const fixedExpenses = useFinanceStore((s) => s.fixedExpenses);
  const cards = useFinanceStore((s) => s.cards);
  const receivables = useFinanceStore((s) => s.receivables);
  const transactions = useFinanceStore((s) => s.transactions);

  const [range, setRange] = useState<'14' | '30' | '60'>('30');
  const [overridePaise, setOverridePaise] = useState<number | null>(null);
  const [editingSpend, setEditingSpend] = useState(false);
  const [spendDraft, setSpendDraft] = useState('');

  // The editable everyday-spend assumption, persisted per device.
  useEffect(() => {
    AsyncStorage.getItem(SPEND_OVERRIDE_KEY)
      .then((raw) => {
        const n = raw === null ? NaN : Number(raw);
        if (isFinite(n) && n >= 0) setOverridePaise(n);
      })
      .catch(() => {});
  }, []);

  const todayKey = localDayKey(new Date());
  const days = Number(range);
  const endKey = shiftLocalDayKey(todayKey, days);

  const accountsTotal = accounts.reduce((sum, acc) => sum + acc.amount, 0);
  const walletTotal = (wallets || []).reduce((sum, w) => sum + w.amount, 0);
  const startBalancePaise = accountsTotal + walletTotal;
  const minBalancePaise = accounts.reduce((sum, acc) => sum + getMinBalanceForAccount(acc.title), 0);

  const computedAvg = useMemo(
    () =>
      computeAverageDailySpend(
        transactions,
        fixedExpenses.map((f) => f.name),
        shiftLocalDayKey(todayKey, -29),
        todayKey,
        30,
      ),
    [transactions, fixedExpenses, todayKey],
  );

  const dailySpendPaise = overridePaise ?? computedAvg;

  const events = useMemo(
    () =>
      buildForecastEvents({
        fixedExpenses,
        cards,
        receivables,
        startKey: todayKey,
        endKey,
      }),
    [fixedExpenses, cards, receivables, todayKey, endKey],
  );

  const forecast = useMemo(
    () =>
      computeCashFlow({
        days,
        startKey: todayKey,
        startBalancePaise,
        minBalancePaise,
        dailySpendPaise,
        events,
      }),
    [days, todayKey, startBalancePaise, minBalancePaise, dailySpendPaise, events],
  );

  const statusStyle =
    forecast.status === 'safe'
      ? { bg: mc.mintDim, fg: mc.mint, label: 'Safe' }
      : forecast.status === 'tight'
        ? { bg: mc.amberDim, fg: mc.amber, label: 'Tight' }
        : { bg: mc.redDim, fg: mc.redSoft, label: 'Short' };

  // Hero subtitle copy.
  const heroCaption = (() => {
    if (forecast.status === 'short') {
      const depth = Math.abs(Math.min(0, forecast.headroomPaise));
      return `You dip ₹${Math.round(depth / 100).toLocaleString('en-IN')} below your minimum on ${shortDayKey(forecast.tightestDateKey)}`;
    }
    const headroom = Math.max(0, forecast.headroomPaise);
    return `Only ₹${Math.round(headroom / 100).toLocaleString('en-IN')} above your ₹${Math.round(minBalancePaise / 100).toLocaleString('en-IN')} minimum at the tightest point`;
  })();

  const firstDipDateKey = useMemo(() => {
    const keys = dayKeyRange(todayKey, endKey);
    for (let i = 0; i < keys.length; i += 1) {
      if (forecast.dailyBalances[i] < minBalancePaise) return keys[i];
    }
    return null;
  }, [forecast, todayKey, endKey, minBalancePaise]);

  const cardInnerWidth = Math.max(200, screenWidth - 2 * 18 - 2 * 14 - 4);

  const saveSpend = () => {
    const n = Number(spendDraft.replace(/[^\d.]/g, ''));
    if (!isNaN(n) && n >= 0) {
      const paise = Math.round(n * 100);
      setOverridePaise(paise);
      AsyncStorage.setItem(SPEND_OVERRIDE_KEY, String(paise)).catch(() => {});
    }
    setEditingSpend(false);
  };

  const resetSpend = () => {
    setOverridePaise(null);
    AsyncStorage.removeItem(SPEND_OVERRIDE_KEY).catch(() => {});
    setEditingSpend(false);
  };

  return (
    <Screen bottomInset={36}>
      <TopBar title="Cash flow" onBack={() => navigation.goBack()} variant="left" />

      <Rise index={0}>
        <SegmentedControl
          options={RANGE_OPTIONS}
          value={range}
          onChange={(k) => setRange(k as '14' | '30' | '60')}
          accent={mc.red}
        />
      </Rise>

      {/* ── Hero: projected balance + step chart ─────────────────────────── */}
      <Rise index={1}>
        <Card>
          <Label>PROJECTED BALANCE ON {shortDayKey(endKey).toUpperCase()}</Label>
          <View style={styles.heroRow}>
            <Text style={styles.heroValue}>{formatRupees(forecast.projectedEndPaise)}</Text>
            <View style={[styles.pill, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.pillText, { color: statusStyle.fg }]}>{statusStyle.label}</Text>
            </View>
          </View>
          <Text style={styles.heroCaption}>{heroCaption}</Text>
          <StepBalanceChart
            width={cardInnerWidth}
            height={150}
            balances={forecast.dailyBalances}
            events={forecast.eventsInWindow}
            startKey={todayKey}
            endKey={endKey}
            minBalancePaise={minBalancePaise}
          />
        </Card>
      </Rise>

      {/* ── Late-lent warning ────────────────────────────────────────────── */}
      {forecast.lentRisk ? (
        <Rise index={2}>
          <Card tone="amber" style={styles.warnCard}>
            <View style={styles.warnRow}>
              <Ionicons name="warning" size={20} color={mc.amber} style={styles.warnIcon} />
              <Text style={styles.warnText}>
                If {forecast.lentRisk.name}&apos;s {formatRupees(forecast.lentRisk.amountPaise)} arrives late, you dip{' '}
                <Text style={styles.warnStrong}>
                  {formatRupees(forecast.lentRisk.belowPaise)} below
                </Text>{' '}
                your minimum on {shortDayKey(forecast.lentRisk.firstDipDateKey)}. Ask for it by{' '}
                {shortDayKey(forecast.lentRisk.dueDateKey)}.
              </Text>
            </View>
          </Card>
        </Rise>
      ) : forecast.status === 'short' && firstDipDateKey ? (
        <Rise index={2}>
          <Card tone="amber" style={styles.warnCard}>
            <View style={styles.warnRow}>
              <Ionicons name="warning" size={20} color={mc.amber} style={styles.warnIcon} />
              <Text style={styles.warnText}>
                Even with the scheduled money, you fall below your minimum on{' '}
                <Text style={styles.warnStrong}>{shortDayKey(firstDipDateKey)}</Text>. Trim a bill or pull
                one forward to stay safe.
              </Text>
            </View>
          </Card>
        </Rise>
      ) : null}

      {/* ── What moves the balance ───────────────────────────────────────── */}
      <Rise index={3}>
        <Card style={styles.timelineCard}>
          <Label>WHAT MOVES YOUR BALANCE</Label>
          {forecast.eventsInWindow.length === 0 ? (
            <Text style={styles.emptyText}>Nothing scheduled in this window.</Text>
          ) : (
            forecast.eventsInWindow.map((event, i) => (
              <TimelineRow key={event.id} event={event} first={i === 0} />
            ))
          )}
        </Card>
      </Rise>

      {/* ── Assumptions ──────────────────────────────────────────────────── */}
      <Rise index={4}>
        <Card>
          <Label>ASSUMPTIONS</Label>
          <View style={styles.assumptionRow}>
            <View style={[styles.tile, { backgroundColor: mc.amberDim }]}>
              <Ionicons name="cart-outline" size={18} color={mc.amber} />
            </View>
            <Text style={styles.assumptionText}>Everyday spending</Text>
            {editingSpend ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.spendInput}
                  value={spendDraft}
                  onChangeText={setSpendDraft}
                  keyboardType="decimal-pad"
                  autoFocus
                  selectTextOnFocus
                  placeholderTextColor={mc.textGhost}
                  placeholder="₹ / day"
                  returnKeyType="done"
                  onSubmitEditing={saveSpend}
                />
                <PressScale onPress={saveSpend} scale={0.9} style={styles.editBtn} accessibilityLabel="Save daily spend">
                  <Ionicons name="checkmark" size={16} color={mc.mint} />
                </PressScale>
                <PressScale onPress={() => setEditingSpend(false)} scale={0.9} style={styles.editBtn} accessibilityLabel="Cancel">
                  <Ionicons name="close" size={16} color={mc.textDim} />
                </PressScale>
              </View>
            ) : (
              <View style={styles.spendRight}>
                <Text style={styles.spendValue}>{formatCompact(dailySpendPaise)} / day</Text>
                <PressScale
                  onPress={() => {
                    setSpendDraft(String(Math.round(dailySpendPaise / 100)));
                    setEditingSpend(true);
                  }}
                  scale={0.9}
                  style={styles.pencilBtn}
                  accessibilityLabel="Edit everyday spending"
                >
                  <Ionicons name="pencil" size={13} color={mc.textDim} />
                </PressScale>
              </View>
            )}
          </View>
          {overridePaise !== null && !editingSpend ? (
            <Pressable onPress={resetSpend} hitSlop={{ top: 6, bottom: 6 }}>
              <Text style={styles.resetText}>Reset to the ₹{Math.round(computedAvg / 100).toLocaleString('en-IN')} computed average</Text>
            </Pressable>
          ) : null}
          <View style={styles.assumptionRow}>
            <View style={[styles.tile, { backgroundColor: mc.skyDim }]}>
              <Ionicons name="business-outline" size={18} color={mc.sky} />
            </View>
            <Text style={styles.assumptionText}>Keep in banks</Text>
            <Text style={styles.assumptionValue}>{formatRupees(minBalancePaise)}</Text>
          </View>
          <View style={styles.assumptionRow}>
            <View style={[styles.tile, { backgroundColor: mc.violetDim }]}>
              <Ionicons name="wallet-outline" size={18} color={mc.violet} />
            </View>
            <Text style={styles.assumptionText}>Start balance (banks and wallets)</Text>
            <Text style={styles.assumptionValue}>{formatRupees(startBalancePaise)}</Text>
          </View>
          <Text style={styles.footnote}>
            Everyday spend is the last 30 days of true spending — SIPs, rent and wallet loads are excluded.
          </Text>
        </Card>
      </Rise>
    </Screen>
  );
}

/* ── The step chart: running balance with bills (red) and inflows (mint) ── */
function StepBalanceChart({
  width,
  height,
  balances,
  events,
  startKey,
  endKey,
  minBalancePaise,
}: {
  width: number;
  height: number;
  balances: number[];
  events: ForecastEvent[];
  startKey: string;
  endKey: string;
  minBalancePaise: number;
}) {
  const keys = dayKeyRange(startKey, endKey);
  const all = [...balances, minBalancePaise];
  const maxV = Math.max(...all, 1);
  const minV = Math.min(...all, 0);
  const span = Math.max(1, maxV - minV);
  const padTop = 14;
  const padBottom = 18;
  const innerH = height - padTop - padBottom;
  const x = (i: number) => (i / (balances.length - 1)) * (width - 8) + 4;
  const y = (v: number) => padTop + ((maxV - v) / span) * innerH;

  // Step path: horizontal runs at the previous value, vertical drops/jumps.
  let d = '';
  let area = '';
  for (let i = 0; i < balances.length; i += 1) {
    const xi = x(i);
    const yi = y(balances[i]);
    if (i === 0) {
      d = `M${xi},${yi}`;
      area = `M${xi},${yi}`;
    } else {
      d += ` H${xi} V${yi}`;
      area += ` H${xi} V${yi}`;
    }
  }
  const base = height - padBottom;
  area += ` V${base} H${x(0)} Z`;

  const eventX = (dateKey: string) => {
    const idx = keys.indexOf(dateKey);
    return idx === -1 ? null : x(idx);
  };

  const minY = y(minBalancePaise);
  const endX = x(balances.length - 1);
  const endY = y(balances[balances.length - 1]);

  const markerEvents = events.filter((e) => eventX(e.dateKey) !== null);

  return (
    <View style={styles.chartWrap}>
      <Svg width={width} height={height}>
        {/* dashed minimum line */}
        <Line
          x1={0}
          y1={minY}
          x2={width}
          y2={minY}
          stroke={mc.redSoft}
          strokeWidth={1}
          strokeDasharray="4 5"
          opacity={0.7}
        />
        <SvgText x={4} y={Math.max(11, minY - 4)} fill={mc.redSoft} fontSize={9} opacity={0.9}>
          {`minimum ${formatCompact(minBalancePaise)}`}
        </SvgText>

        <Path d={area} fill={mc.red} opacity={0.08} />
        <Path d={d} fill="none" stroke={mc.red} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />

        {/* event markers */}
        {markerEvents.map((e) => {
          const idx = keys.indexOf(e.dateKey);
          if (idx === -1) return null;
          const mx = eventX(e.dateKey);
          if (mx === null) return null;
          const my = y(balances[idx]);
          const isIn = e.amountPaise > 0;
          return (
            <Circle
              key={e.id}
              cx={mx}
              cy={my}
              r={4}
              fill={isIn ? mc.mint : '#FF5A6E'}
              stroke={mc.canvas}
              strokeWidth={1.5}
            />
          );
        })}
        <Circle cx={endX} cy={endY} r={5} fill={mc.red} stroke={mc.canvas} strokeWidth={1.5} />

        {/* x axis labels */}
        <SvgText x={4} y={height - 2} fill={mc.textDim} fontSize={9}>
          {shortDayKey(keys[0])}
        </SvgText>
        <SvgText x={width / 2} y={height - 2} fill={mc.textDim} fontSize={9} textAnchor="middle">
          {shortDayKey(keys[Math.floor(keys.length / 2)])}
        </SvgText>
        <SvgText x={width - 4} y={height - 2} fill={mc.redSoft} fontSize={9} textAnchor="end">
          {shortDayKey(keys[keys.length - 1])}
        </SvgText>
      </Svg>
    </View>
  );
}

function TimelineRow({ event, first }: { event: ForecastEvent; first: boolean }) {
  const isIn = event.amountPaise > 0;
  return (
    <View style={[styles.row, first && styles.rowFirst]}>
      <View style={styles.dateChip}>
        <Text style={styles.dateChipMonth}>{monthOfKey(event.dateKey)}</Text>
        <Text style={styles.dateChipDay}>{dayOfKey(event.dateKey)}</Text>
      </View>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.rowSub}>{event.subtitle}</Text>
      </View>
      <Text style={[styles.rowAmount, { color: isIn ? mc.mint : '#FF6F82' }]}>
        {isIn ? '+' : '-'}
        {formatRupees(Math.abs(event.amountPaise))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  heroValue: {
    fontSize: 34,
    fontWeight: '500',
    color: mc.text,
    letterSpacing: 0.2,
  },
  pill: {
    borderRadius: mr.chip,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroCaption: {
    fontSize: 12,
    color: mc.textDim,
    marginBottom: 4,
  },
  chartWrap: {
    marginTop: 4,
  },
  warnCard: {
    borderWidth: 1,
    borderColor: '#6A4A12',
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  warnIcon: {
    marginTop: 1,
  },
  warnText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#E8D9B5',
  },
  warnStrong: {
    color: mc.amber,
    fontWeight: '600',
  },
  timelineCard: {
    paddingBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: mc.textDim,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  dateChip: {
    width: 44,
    alignItems: 'center',
  },
  dateChipMonth: {
    fontSize: 10,
    color: mc.textDim,
    letterSpacing: 0.8,
  },
  dateChipDay: {
    fontSize: 17,
    fontWeight: '500',
    color: mc.text,
    lineHeight: 21,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    color: mc.text,
  },
  rowSub: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 1,
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  assumptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  tile: {
    width: 38,
    height: 38,
    borderRadius: mr.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assumptionText: {
    flex: 1,
    fontSize: 14,
    color: mc.text,
  },
  assumptionValue: {
    fontSize: 14,
    color: mc.textDim,
    fontVariant: ['tabular-nums'],
  },
  spendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spendValue: {
    fontSize: 13,
    color: mc.text,
    backgroundColor: mc.chip,
    borderRadius: mr.tag + 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  },
  pencilBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: mc.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spendInput: {
    minWidth: 92,
    backgroundColor: mc.raised,
    borderRadius: mr.tag + 4,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    color: mc.text,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: mc.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: {
    fontSize: 12,
    color: mc.textDim,
    marginLeft: 50,
    marginTop: -2,
    marginBottom: 6,
    textDecorationLine: 'underline',
  },
  footnote: {
    fontSize: 11,
    color: mc.textGhost,
    marginTop: 10,
    lineHeight: 16,
  },
});
