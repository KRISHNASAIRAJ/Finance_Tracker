/**
 * Today card — score, decision and evidence together (spec §5.1).
 *
 * This is the only new surface on Home. It sits above the existing grid and
 * is fully rule-based: no network, no AI, no writes. Every number comes from
 * the user's own stores through useDecisionEngine.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import { Card, Label, PressScale, Ring } from '../../../shared/components/meridian';
import { formatSleepDuration } from '../../sleep/store';
import { formatRupees } from '../../finance/financeFormat';
import { useDecisionEngine } from '../hooks/useDecisionEngine';
import { openCallTarget, openWhyScreen } from '../navigation';
import EvidenceChip from './EvidenceChip';

export default function TodayCard() {
  const { score, call, input, baselines, sleepMinutes, dailySpendRupees, tasksDueToday, billsDueSoon, budgetPace } =
    useDecisionEngine();

  const learning = score.learning.length > 0;
  const delta = score.score - 50;
  const chipLabel = learning
    ? 'Learning your normal'
    : `${delta >= 0 ? '+' : ''}${delta} vs neutral`;
  const sleepNormal = baselines.sleep?.median ?? 0;

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <Ring progress={score.score / 100} size={82} stroke={7} color={bandColor(score.band)}>
          <Text style={styles.score}>{score.score}</Text>
          <Text style={styles.band}>{score.band.toUpperCase()}</Text>
        </Ring>
        <View style={styles.topText}>
          <View style={styles.chip}>
            <Ionicons name="pulse-outline" size={12} color={mc.textDim} />
            <Text style={styles.chipText}>{chipLabel}</Text>
          </View>
          <Text style={styles.subtitle}>Day score</Text>
          <Text style={styles.subNote}>
            {score.missing.length > 0
              ? `${score.missing.length} part${score.missing.length === 1 ? '' : 's'} had no data and were left out.`
              : 'Sleep 30 · Money 30 · Tasks 20 · Habits 20'}
          </Text>
        </View>
      </View>

      <View style={styles.callBlock}>
        <Label>Today's call</Label>
        <Text style={styles.headline}>{call.headline}</Text>
        <Text style={styles.reason}>{call.reason}</Text>

        {call.evidence.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.evidenceRow}
            contentContainerStyle={styles.evidenceContent}
          >
            {call.evidence.map((item) => (
              <EvidenceChip key={item.id} item={item} />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.actions}>
          <PressScale onPress={openWhyScreen} style={styles.secondary}>
            <Text style={styles.secondaryText}>Why this?</Text>
          </PressScale>
          <PressScale onPress={() => openCallTarget(call.target)} style={styles.primary}>
            <Text style={styles.primaryText}>Do it</Text>
            <Ionicons name="arrow-forward" size={14} color={mc.ink} />
          </PressScale>
        </View>
      </View>

      <View style={styles.rows}>
        <MiniRow label="Due today" value={`${tasksDueToday + billsDueSoon}`} />
        <MiniRow label="Next bill" value={input.bill?.name ?? (billsDueSoon > 0 ? `${billsDueSoon}` : '—')} />
        <MiniRow
          label="Sleep last night"
          value={sleepMinutes !== null ? formatSleepDuration(sleepMinutes / 60) : '—'}
        />
        <MiniRow
          label="Budget pace"
          value={
            budgetPace === null
              ? 'No budget'
              : `${Math.round(budgetPace * 100)}% of plan`
          }
        />
      </View>

      {call.alsoConsider.length > 0 ? (
        <Text style={styles.also}>
          Also worth a look: {call.alsoConsider.map((c) => c.headline).join(' · ')}
        </Text>
      ) : null}

      {dailySpendRupees !== null && sleepNormal > 0 ? (
        <Text style={styles.footer}>
          Today {formatRupees(dailySpendRupees * 100)} · usual night {Math.round(sleepNormal)} min · {input.samples.spend?.length ?? 0} spend days
        </Text>
      ) : null}
    </Card>
  );
}

function bandColor(band: 'Good' | 'Steady' | 'Low'): string {
  if (band === 'Good') return mc.mint;
  if (band === 'Steady') return mc.amber;
  return mc.red;
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniRow}>
      <Text style={styles.miniLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.miniValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  score: { fontSize: 28, fontWeight: '500', color: mc.text },
  band: { fontSize: 9, fontWeight: '600', letterSpacing: 1, color: mc.textDim, marginTop: -2 },
  topText: { flex: 1, gap: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: mc.raised,
    borderRadius: mr.chip,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chipText: { fontSize: 10, color: mc.textDim },
  subtitle: { fontSize: 13, color: mc.text },
  subNote: { fontSize: 10.5, color: mc.textFaint, lineHeight: 15 },
  callBlock: { gap: 6 },
  headline: { fontSize: 17, fontWeight: '500', color: mc.text, lineHeight: 23 },
  reason: { fontSize: 12, color: mc.textDim, lineHeight: 17 },
  evidenceRow: { marginTop: 6 },
  evidenceContent: { gap: 8, paddingRight: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  secondary: {
    backgroundColor: mc.raised,
    borderRadius: mr.chip,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryText: { fontSize: 12, fontWeight: '500', color: mc.text },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mc.red,
    borderRadius: mr.chip,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  primaryText: { fontSize: 12, fontWeight: '600', color: mc.ink },
  rows: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mc.line,
    paddingTop: 12,
  },
  miniRow: {
    width: '48%',
    backgroundColor: mc.raised,
    borderRadius: mr.row,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 2,
  },
  miniLabel: { fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase', color: mc.textDim },
  miniValue: { fontSize: 13, fontWeight: '500', color: mc.text },
  also: { fontSize: 11, color: mc.textFaint, lineHeight: 16 },
  footer: { fontSize: 10, color: mc.textGhost, lineHeight: 14 },
});
