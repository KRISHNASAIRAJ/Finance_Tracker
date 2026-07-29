import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Animated,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tc, ts, tr } from '../../theme/tracend';

interface DockItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  onPress?: () => void;
}

interface DockProps {
  items: DockItem[];
  style?: ViewStyle;
}

export type { DockItem, DockProps };

export default function Dock({ items, style }: DockProps) {
  const [active, setActive] = useState<string | null>(null);
  const scaleAnims = useRef(items.map(() => new Animated.Value(1))).current;

  const handlePress = (item: DockItem, index: number) => {
    Animated.sequence([
      Animated.timing(scaleAnims[index], {
        toValue: 0.88,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnims[index], {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    setActive(item.label);
    item.onPress?.();
  };

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.container}>
        {items.map((item, i) => {
          const isActive = active === item.label;
          const iconColor = isActive
            ? item.color ?? tc.action
            : tc.textSecondary;

          return (
            <View key={item.label} style={styles.itemRow}>
              <Animated.View
                style={[
                  styles.itemWrapper,
                  { transform: [{ scale: scaleAnims[i] }] },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.iconBtn,
                    isActive && {
                      backgroundColor:
                        (item.color ?? tc.action).replace(')', ', 0.12)').replace('rgb', 'rgba'),
                    },
                  ]}
                  onPress={() => handlePress(item, i)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.icon}
                    size={22}
                    color={iconColor}
                  />
                </TouchableOpacity>
              </Animated.View>
              {isActive && <View style={[styles.dot, { backgroundColor: item.color ?? tc.action }]} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ts.xl,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: ts.lg,
    paddingHorizontal: ts.lg,
    paddingVertical: ts.md,
    borderRadius: tr.xl,
    backgroundColor: tc.surfaceContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  itemRow: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  itemWrapper: {
    borderRadius: tr.md,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: tr.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
