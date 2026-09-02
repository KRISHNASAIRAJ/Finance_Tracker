/**
 * ExpandableTransactionCard — a transaction row that springs open when tapped
 * to reveal details, and can be swiped LEFT to reveal Edit/Delete action
 * buttons sitting absolutely behind the row.
 *
 * Swipe mechanics (per spec):
 *  - pointer move translates the row left, clamped to 0 on the right
 *  - release past ~half the action width (or a leftward fling) springs it
 *    open and holds it at translateX(-96px); otherwise it springs back to 0
 *  - action buttons sit absolutely behind the row, full-height
 *
 * Height animation on expand uses LayoutAnimation spring (the RN equivalent
 * of cubic-bezier(0.34, 1.56, 0.64, 1)); secondary text fades in with a
 * small delay once expanded.
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  Animated,
  LayoutAnimation,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import { rounded } from '../theme/spacing';
import CategoryIcon from '../CategoryIcon';
import { getCategoryColor } from '../categoryMap';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Width of the revealed action strip — rows hold open at -ACTIONS_W. */
const ACTIONS_W = 96;

interface ExpandableTransactionCardProps {
  tx: any;
  formatAmount: (paise: number) => string;
  onPressEdit?: () => void;
  onPressDelete?: () => void;
  /** Optional override for the accent colour; uses category colour by default */
  accent?: string;
}

export default function ExpandableTransactionCard({
  tx,
  formatAmount,
  onPressEdit,
  onPressDelete,
  accent,
}: ExpandableTransactionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const detailOpacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const offsetRef = useRef(0); // 0 or -ACTIONS_W

  const isIncome = tx.type === 'income';
  const catColor = accent || getCategoryColor(tx.category, isIncome);

  const settle = useCallback(
    (target: number) => {
      offsetRef.current = target;
      setOpen(target !== 0);
      Animated.spring(translateX, {
        toValue: target,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }).start();
    },
    [translateX]
  );

  const closeActions = useCallback(() => settle(0), [settle]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderMove: (_evt, g) => {
        const next = Math.max(-ACTIONS_W, Math.min(0, offsetRef.current + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_evt, g) => {
        const draggedFar = g.dx < -ACTIONS_W / 2;
        const flungLeft = g.vx < -0.4;
        const flungRight = g.vx > 0.4;
        if (offsetRef.current === 0) {
          settle(draggedFar || flungLeft ? -ACTIONS_W : 0);
        } else {
          settle(g.dx > ACTIONS_W / 2 || flungRight ? 0 : -ACTIONS_W);
        }
      },
      onPanResponderTerminate: () => settle(offsetRef.current === 0 ? 0 : -ACTIONS_W),
    })
  ).current;

  const toggle = useCallback(() => {
    if (open) {
      // Swipe actions are open — a tap closes them instead of toggling details
      closeActions();
      return;
    }
    LayoutAnimation.configureNext({
      duration: 500,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.spring, springDamping: 0.6, initialVelocity: 0 },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    const next = !expanded;
    setExpanded(next);
    Animated.timing(detailOpacity, {
      toValue: next ? 1 : 0,
      duration: 200,
      delay: next ? 150 : 0,
      useNativeDriver: true,
    }).start();
  }, [open, expanded, detailOpacity, closeActions]);

  const methodLabel = (() => {
    const raw = tx.paymentMode || '';
    if (!raw) return 'N/A';
    const parts = String(raw).split(':');
    return parts.length > 1 && parts[1] ? `${parts[0].toUpperCase()} · ${parts[1]}` : parts[0].toUpperCase();
  })();

  const dateObj = new Date(tx.date);
  const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={styles.wrap}>
      {/* Action buttons — sit absolutely behind the row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionEdit]}
          activeOpacity={0.75}
          onPress={() => { settle(0); onPressEdit?.(); }}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.actionLabel}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionDelete]}
          activeOpacity={0.75}
          onPress={() => { settle(0); onPressDelete?.(); }}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.actionLabel}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* The row itself — translated by the pan responder */}
      <Animated.View
        style={[styles.rowSurface, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity activeOpacity={0.9} onPress={toggle} style={styles.card}>
          <View style={styles.mainRow}>
            <View style={styles.left}>
              <View style={[styles.iconBox, { backgroundColor: `${catColor}20` }]}>
                <CategoryIcon category={tx.category} size={18} color={catColor} />
              </View>
              <View style={styles.details}>
                <Text style={styles.title} numberOfLines={1}>{tx.notes || tx.category}</Text>
                <Text style={styles.subtitle}>{tx.category} · {dateStr}</Text>
              </View>
            </View>
            <View style={styles.right}>
              <Text style={[styles.amount, { color: isIncome ? colors.success : catColor }]}>
                {isIncome ? '+' : '-'}{formatAmount(tx.amount)}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={colors.outline}
                style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
              />
            </View>
          </View>

          {expanded && (
            <Animated.View style={{ opacity: detailOpacity }}>
              <View style={styles.divider} />
              <View style={styles.detailGrid}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>TRANSACTION</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>{tx.notes || tx.category}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>AMOUNT</Text>
                  <Text style={[styles.detailValue, { fontWeight: '700' }]}>
                    {isIncome ? '+' : '-'}{formatAmount(tx.amount)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>PAYMENT</Text>
                  <Text style={styles.detailValue}>{methodLabel}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>CATEGORY</Text>
                  <Text style={styles.detailValue}>{tx.category}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>DATE</Text>
                  <Text style={styles.detailValue}>{dateStr} · {timeStr}</Text>
                </View>
              </View>
              <View style={styles.swipeHint}>
                <Ionicons name="swap-horizontal-outline" size={11} color={colors.outline} />
                <Text style={styles.swipeHintText}>Swipe left for Edit / Delete</Text>
              </View>
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    marginBottom: 6,
    borderRadius: rounded.DEFAULT,
    overflow: 'hidden',
  },
  rowSurface: {
    backgroundColor: colors.surfaceContainer,
  },
  actionsRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: ACTIONS_W,
    flexDirection: 'row',
    borderRadius: rounded.DEFAULT,
    overflow: 'hidden',
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  actionEdit: {
    backgroundColor: '#3a4fc9',
  },
  actionDelete: {
    backgroundColor: '#c0392b',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.DEFAULT,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: rounded.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  subtitle: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  detailGrid: { gap: 8 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.onSurfaceVariant,
    width: 64,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.onSurface,
    textAlign: 'right',
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
  },
  swipeHintText: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
});