/**
 * "How this is calculated" sheet. Every number shown here is read from the
 * same config the engine used — nothing is retyped in the UI.
 */
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import { Label, PressScale } from '../../../shared/components/meridian';
import { DECISION_CONFIG } from '../config';
import type { DayScore } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  score: DayScore;
}

export default function WeightSheet({ visible, onClose, score }: Props) {
  const { score: cfg, baseline, rules, fallback } = DECISION_CONFIG;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>How this is calculated</Text>
            <PressScale onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={18} color={mc.textDim} />
            </PressScale>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>
              A 0–100 score from four parts. Each part compares today with your own
              normal, then the parts are weighted.
            </Text>

            <Label>Weights</Label>
            <View style={styles.block}>
              {score.components.map((c) => (
                <View key={c.key} style={styles.row}>
                  <Text style={styles.rowLabel}>{labelFor(c.key)}</Text>
                  <Text style={styles.rowValue}>
                    {Math.round(c.weight * 100)}% · {c.score}/100
                  </Text>
                </View>
              ))}
              {score.missing.length > 0 ? (
                <Text style={styles.note}>
                  Left out: {score.missing.map(labelFor).join(', ')}. The remaining
                  weights were scaled up to add to 100%.
                </Text>
              ) : null}
            </View>

            <Label>Bands</Label>
            <View style={styles.block}>
              <Text style={styles.note}>
                Good ≥ {cfg.bands.good} · Steady {cfg.bands.steady}–{cfg.bands.good - 1} · Low &lt; {cfg.bands.steady}
              </Text>
              <Text style={styles.note}>
                Each part = {cfg.neutral} + {cfg.zFactor} × z, with z clamped to ±{cfg.zClamp}.
              </Text>
            </View>

            <Label>Your normal</Label>
            <View style={styles.block}>
              <Text style={styles.note}>
                Rolling {baseline.windowDays}-day median with a spread of 1.4826 ×
                median absolute deviation. Needs at least {baseline.minSamples} days;
                below that a fixed target is used and shown as “Learning your normal”.
              </Text>
              <Text style={styles.note}>
                Spend uses the same weekday over {baseline.weekdayWeeks} weeks when at
                least {baseline.weekdayMinSamples} such days exist.
              </Text>
            </View>

            <Label>Decision thresholds</Label>
            <View style={styles.block}>
              <Text style={styles.note}>
                Cash gap within {rules.cashflowHorizonDays} days · bill within{' '}
                {rules.billWindowDays} days · month pace above {Math.round(rules.budgetPace * 100)}% ·
                short night ≥ {rules.shortNightMinutes} min · high spend &gt;{' '}
                {Math.round(rules.highSpendMultiple * 100)}% of normal.
              </Text>
            </View>

            <Label>Fixed targets while learning</Label>
            <View style={styles.block}>
              <Text style={styles.note}>
                Sleep {fallback.sleepMinutes} min · daily spend ₹{fallback.dailySpendRupees} ·
                habits {Math.round(fallback.habitsDoneRate * 100)}% · due items{' '}
                {fallback.commitmentsDue}.
              </Text>
            </View>

            <Text style={styles.disclaimer}>
              General information from your own data, not professional advice.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function labelFor(key: string): string {
  switch (key) {
    case 'sleep':
      return 'Sleep';
    case 'moneyPace':
      return 'Money pace';
    case 'commitments':
      return 'Commitments';
    case 'habits':
      return 'Habits';
    default:
      return key;
  }
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: mc.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: mc.card,
    borderTopLeftRadius: mr.card,
    borderTopRightRadius: mr.card,
    padding: 18,
    maxHeight: '88%',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 19, fontWeight: '500', color: mc.text },
  close: { padding: 6 },
  intro: { fontSize: 13, color: mc.textDim, lineHeight: 19, marginTop: 10, marginBottom: 18 },
  block: {
    backgroundColor: mc.raised,
    borderRadius: mr.row,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    gap: 7,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 13, color: mc.text },
  rowValue: { fontSize: 12, color: mc.textDim },
  note: { fontSize: 11.5, color: mc.textDim, lineHeight: 17 },
  disclaimer: { fontSize: 10.5, color: mc.textGhost, textAlign: 'center', marginBottom: 8 },
});
