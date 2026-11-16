/**
 * Why this score? — a time-ordered timeline of yesterday and last night
 * (spec §5.2). Every node links to the real log entry and shows its effect;
 * the "Usually" column shows the personal normal for that metric.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { mc, mr } from '../../../shared/theme/meridian';
import {
  Card,
  Label,
  PressScale,
  Ring,
  Screen,
  TimelineItem,
  TopBar,
} from '../../../shared/components/meridian';
import { useFinanceStore } from '../../finance/store';
import { useSleepStore, formatSleepDuration } from '../../sleep/store';
import { formatRupees, localDayKey, shiftLocalDayKey } from '../../finance/financeFormat';
import { useDecisionEngine } from '../hooks/useDecisionEngine';
import { openCallTarget, openEvidenceTarget } from '../navigation';
import type { ComponentKey, EvidenceTarget } from '../types';
import WeightSheet from '../components/WeightSheet';
import EvidenceChip from '../components/EvidenceChip';

interface Node {
  id: string;
  time: string;
  title: string;
  detail: string;
  usual: string;
  effect: number;
  color: string;
  target: EvidenceTarget;
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function WhyThisScoreScreen() {
  const navigation = useNavigation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { score, call, baselines, input } = useDecisionEngine();
  const transactions = useFinanceStore((s) => s.transactions);
  const sleepEntries = useSleepStore((s) => s.entries);

  const effectOf = (key: ComponentKey) => {
    const c = score.components.find((x) => x.key === key);
    return c ? Math.round(c.score - 50) : 0;
  };

  const nodes = useMemo<Node[]>(() => {
    const yesterday = shiftLocalDayKey(localDayKey(new Date()), -1);
    const list: Node[] = [];

    const lastSleep = [...sleepEntries].sort(
      (a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
    )[0];
    if (lastSleep) {
      list.push({
        id: 'sleep',
        time: clockTime(lastSleep.startTime),
        title: 'Slept',
        detail: formatSleepDuration(
          (new Date(lastSleep.endTime).getTime() - new Date(lastSleep.startTime).getTime()) /
            3600000
        ),
        usual: `${Math.round(baselines.sleep?.median ?? 0)} min usual`,
        effect: effectOf('sleep'),
        color: mc.violet,
        target: 'SleepTracker',
      });
    }

    const yesterdaySpend = transactions
      .filter(
        (t) =>
          ['expense', 'fuel_purchase', 'vehicle_service'].includes(t.type) &&
          localDayKey(new Date(t.date)) === yesterday
      )
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
    for (const t of yesterdaySpend) {
      list.push({
        id: `spend-${t.id}`,
        time: clockTime(t.date),
        title: `Spent ${formatRupees(t.amount)}`,
        detail: t.category || 'Expense',
        usual: `₹${Math.round(baselines.spend?.median ?? 0)}/day usual`,
        effect: effectOf('moneyPace'),
        color: mc.sky,
        target: 'FinanceHome',
      });
    }

    list.push({
      id: 'habits',
      time: '—',
      title: 'Habits yesterday',
      detail: `${Math.round((input.habitsYesterdayRate ?? 0) * 100)}% done`,
      usual: `${Math.round((baselines.habits?.median ?? 0) * 100)}% usual`,
      effect: effectOf('habits'),
      color: mc.mint,
      target: 'HabitTracker',
    });

    list.push({
      id: 'commitments',
      time: 'Today',
      title: 'Due now',
      detail: `${input.tasksDueToday} tasks · ${input.billsDueSoon} bills in 3 days`,
      usual: '2 or fewer usual',
      effect: effectOf('commitments'),
      color: mc.amber,
      target: 'TasksDashboard',
    });

    return list.sort((a, b) => (a.time === '—' ? -1 : b.time === '—' ? 1 : a.time.localeCompare(b.time)));
  }, [transactions, sleepEntries, baselines, input, score]);

  return (
    <Screen bottomInset={24}>
      <TopBar
        title="Why this score?"
        subtitle={input.today}
        onBack={() => navigation.goBack()}
        right={
          <PressScale onPress={() => setSheetOpen(true)} style={styles.info}>
            <Ionicons name="information-circle-outline" size={19} color={mc.textDim} />
          </PressScale>
        }
      />

      <Card style={styles.hero}>
        <Ring progress={score.score / 100} size={92} stroke={8} color={mc.violet}>
          <Text style={styles.heroScore}>{score.score}</Text>
        </Ring>
        <View style={styles.heroText}>
          <Label>{score.band} day</Label>
          <Text style={styles.heroCall}>{call.headline}</Text>
          <Text style={styles.heroReason}>{call.reason}</Text>
        </View>
      </Card>

      <Label style={styles.section}>Timeline</Label>
      <Card style={styles.timelineCard}>
        {nodes.map((node, i) => (
          <TimelineItem key={node.id} color={node.color} last={i === nodes.length - 1}>
            <PressScale onPress={() => openEvidenceTarget(node.target)} style={styles.node}>
              <View style={styles.nodeTop}>
                <Text style={styles.nodeTime}>{node.time}</Text>
                <Text style={[styles.effect, { color: node.effect >= 0 ? mc.mint : mc.redSoft }]}>
                  {node.effect >= 0 ? '+' : ''}
                  {node.effect} pts
                </Text>
              </View>
              <Text style={styles.nodeTitle}>{node.title}</Text>
              <Text style={styles.nodeDetail}>{node.detail}</Text>
              <Text style={styles.nodeUsual}>Usually: {node.usual}</Text>
            </PressScale>
          </TimelineItem>
        ))}
      </Card>

      <Label style={styles.section}>The call</Label>
      <Card tone="violet" style={styles.callCard}>
        <Text style={styles.callHeadline}>{call.headline}</Text>
        <Text style={styles.callReason}>{call.reason}</Text>
        <View style={styles.chips}>
          {call.evidence.map((item) => (
            <EvidenceChip key={item.id} item={item} compact />
          ))}
        </View>
        <PressScale onPress={() => openCallTarget(call.target)} style={styles.openBtn}>
          <Text style={styles.openText}>Open source</Text>
          <Ionicons name="arrow-forward" size={14} color={mc.ink} />
        </PressScale>
      </Card>

      <WeightSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        score={score}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  info: { padding: 6 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroScore: { fontSize: 30, fontWeight: '500', color: mc.text },
  heroText: { flex: 1, gap: 4 },
  heroCall: { fontSize: 15, fontWeight: '500', color: mc.text, lineHeight: 21 },
  heroReason: { fontSize: 11.5, color: mc.textDim, lineHeight: 16 },
  section: { marginTop: 16, marginLeft: 4, marginBottom: 8 },
  timelineCard: { gap: 14 },
  node: { backgroundColor: mc.raised, borderRadius: mr.row, padding: 12, marginBottom: 4 },
  nodeTop: { flexDirection: 'row', justifyContent: 'space-between' },
  nodeTime: { fontSize: 10, letterSpacing: 0.8, color: mc.textDim },
  effect: { fontSize: 11, fontWeight: '600' },
  nodeTitle: { fontSize: 13, fontWeight: '500', color: mc.text, marginTop: 4 },
  nodeDetail: { fontSize: 11.5, color: mc.textDim, marginTop: 2 },
  nodeUsual: { fontSize: 10, color: mc.textGhost, marginTop: 4 },
  callCard: { gap: 7 },
  callHeadline: { fontSize: 16, fontWeight: '500', color: mc.text, lineHeight: 22 },
  callReason: { fontSize: 12, color: mc.textDim, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: mc.red,
    borderRadius: mr.chip,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 6,
  },
  openText: { fontSize: 12, fontWeight: '600', color: mc.ink },
});
