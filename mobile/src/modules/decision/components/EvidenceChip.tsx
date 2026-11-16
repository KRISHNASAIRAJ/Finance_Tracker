/**
 * A compact evidence chip: the number that backs today's call, and the
 * screen it came from. Tapping it opens that source screen.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { mc, mr } from '../../../shared/theme/meridian';
import { PressScale } from '../../../shared/components/meridian';
import { openEvidenceTarget } from '../navigation';
import type { EvidenceItem } from '../types';

interface Props {
  item: EvidenceItem;
  compact?: boolean;
}

export default function EvidenceChip({ item, compact }: Props) {
  return (
    <PressScale onPress={() => openEvidenceTarget(item.target)} style={styles.chip}>
      <View style={styles.inner}>
        <Text style={styles.label} numberOfLines={1}>
          {item.label}
        </Text>
        <Text style={[styles.value, compact && styles.valueCompact]} numberOfLines={1}>
          {item.value}
        </Text>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: mc.raised,
    borderRadius: mr.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mc.lineSoft,
    paddingHorizontal: 11,
    paddingVertical: 7,
    maxWidth: 160,
  },
  inner: { gap: 2 },
  label: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: mc.textDim,
  },
  value: {
    fontSize: 12,
    fontWeight: '500',
    color: mc.text,
  },
  valueCompact: { fontSize: 11 },
});
