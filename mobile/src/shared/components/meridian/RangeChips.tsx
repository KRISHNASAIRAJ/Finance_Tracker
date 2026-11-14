/**
 * RangeChips — the small "1D / 1W / 1M / 1Y" pill row.
 *
 * The active chip is filled with the accent and the rest stay muted.
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { alpha, mc } from '../../theme/meridian';
import PressScale from './PressScale';

interface RangeChipsProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  /** The accent used for the active chip. */
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

export default function RangeChips({
  options,
  value,
  onChange,
  accent = mc.redSoft,
  style,
}: RangeChipsProps) {
  return (
    <View style={[styles.row, style]}>
      {options.map((o) => {
        const active = o === value;
        return (
          <PressScale key={o} onPress={() => onChange(o)} scale={0.94}>
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: active ? alpha(accent, 0.16) : 'transparent',
                  borderColor: active ? alpha(accent, 0.4) : 'transparent',
                },
              ]}
            >
              <Text style={[styles.text, active && { color: accent, fontWeight: '600' }]}>{o}</Text>
            </View>
          </PressScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 12,
    color: mc.textDim,
  },
});
