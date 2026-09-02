/**
 * SyncStatusCard — Token-bucket rate-limiter state animation for cloud sync.
 *
 * Five pips, spent left to right in quick succession (instantly → 429),
 * then the pips return one at a time on a slow, uneven drip with a spring
 * overshoot (recovery is patient). The card also shows the last synced time,
 * pending count, and actionable error details.
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tc, glass, ts, tr } from '../theme/tracend';

type Phase = 'idle' | 'spending' | 'cooling' | 'recovering' | 'synced';

interface SyncStatusCardProps {
  phase: Phase;
  queueCount: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  lastSyncedAt: string | null;
  syncing: boolean;
  onSyncNow: () => void;
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatAbsolute(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

const PIP_COUNT = 5;
const RECOVERY_INTERVALS = [2000, 3000, 1500, 4000, 2500];

export default function SyncStatusCard({
  phase: externalPhase,
  queueCount,
  lastError,
  lastAttemptAt,
  lastSyncedAt,
  syncing,
  onSyncNow,
}: SyncStatusCardProps) {
  // ─── Animation values ───────────────────────────────────
  const pips = useRef(
    Array.from({ length: PIP_COUNT }, () => new Animated.Value(0))
  ).current;
  const cooldown = useRef(new Animated.Value(0)).current;
  const statusGlow = useRef(new Animated.Value(0)).current;

  const syncingRef = useRef(syncing);

  const [phase, setPhase] = React.useState<Phase>(externalPhase);

  useEffect(() => {
    syncingRef.current = syncing;
  }, [syncing]);

  // Trigger spend → recover loop when syncing becomes true
  useEffect(() => {
    if (!syncing) {
      setPhase('idle');
      if (queueCount === 0 && !lastError) {
        setPhase('synced');
      }
      return;
    }

    // Spend phase: all pips drain left→right
    setPhase('spending');
    const spendTiming = pips.map((pip, i) =>
      Animated.timing(pip, {
        toValue: 1,
        duration: 150,
        delay: i * 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );

    // Cooldown: arc sweep, status flips
    const coolAnim = Animated.timing(cooldown, {
      toValue: 1,
      duration: 800,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    });

    // Recovery: pips return staggered on slow drip with spring overshoot
    const recoverTiming = pips.map((pip, i) =>
      Animated.spring(pip, {
        toValue: 0,
        delay: RECOVERY_INTERVALS[i],
        stiffness: 180,
        damping: 14,
        useNativeDriver: true,
      })
    );

    const sequence = Animated.sequence([
      // Spend
      Animated.parallel(spendTiming),
      // Status glow 429
      Animated.timing(statusGlow, { toValue: 1, duration: 200, useNativeDriver: true }),
      // Cooldown arc
      Animated.parallel([coolAnim, Animated.delay(400)]),
      // Recover
      Animated.parallel(recoverTiming),
      // Done
      Animated.timing(statusGlow, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]);

    sequence.start(() => {
      if (!syncingRef.current) {
        setPhase('synced');
      }
    });

    return () => sequence.stop();
  }, [syncing, pips, cooldown, statusGlow, queueCount, lastError]);

  // Status pill color & label
  const statusInfo = useMemo(() => {
    if (syncing) {
      return { label: '429 RATE LIMITED', color: tc.amber };
    }
    if (lastError) return { label: '429 ERROR', color: tc.attention };
    if (queueCount > 0) return { label: `${queueCount} PENDING`, color: tc.amber };
    return { label: '200 OK', color: tc.stable };
  }, [syncing, queueCount, lastError]);

  const pipBg = statusInfo.color === tc.stable ? tc.stable : tc.amber;

  return (
    <View style={styles.card}>
      {/* Header: status pill + last synced */}
      <View style={styles.headerRow}>
        <View style={[styles.statusPill, { backgroundColor: statusInfo.color + '22', borderColor: statusInfo.color + '44' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
          <Text style={[styles.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>
        <Text style={styles.lastSynced}>
          {lastSyncedAt ? `${formatRelative(lastSyncedAt)}` : 'never synced'}
        </Text>
      </View>

      {/* Pip row */}
      <View style={styles.pipRow}>
        {pips.map((anim, i) => (
          <Pip key={i} anim={anim} color={pipBg} />
        ))}
      </View>

      {/* Cooldown arc */}
      <View style={styles.arcRow}>
        <Animated.View
          style={[
            styles.arc,
            {
              opacity: phase === 'cooling' || phase === 'recovering' ? 1 : 0,
              transform: [
                {
                  rotate: cooldown.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.arcTip} />
        </Animated.View>
      </View>

      {/* Pending count */}
      {queueCount > 0 && !lastError && (
        <Text style={styles.pendingLine}>
          {queueCount} item{queueCount > 1 ? 's' : ''} still waiting to sync
        </Text>
      )}

      {/* Error card */}
      {lastError && (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={14} color={tc.attention} />
          <Text style={styles.errorText} numberOfLines={3}>{lastError}</Text>
        </View>
      )}

      {/* Sync button */}
      <TouchableOpacity
        style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
        onPress={onSyncNow}
        disabled={syncing}
        activeOpacity={0.7}
      >
        <Ionicons
          name={syncing ? 'sync-outline' : 'cloud-upload-outline'}
          size={16}
          color={tc.textPrimary}
          style={syncing ? styles.syncSpinner : undefined}
        />
        <Text style={styles.syncBtnText}>
          {syncing ? 'Syncing…' : 'Sync Now'}
        </Text>
      </TouchableOpacity>

      {lastAttemptAt && (
        <Text style={styles.attemptLine}>
          Last attempt: {formatRelative(lastAttemptAt)} ({formatAbsolute(lastAttemptAt)})
        </Text>
      )}
    </View>
  );
}

function Pip({ anim, color }: { anim: Animated.Value; color: string }) {
  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['100%', '0%'],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.6, 0.2],
  });

  return (
    <View style={[styles.pipTrack, { borderColor: color + '33' }]}>
      <Animated.View
        style={[
          styles.pipFill,
          { backgroundColor: color, width, opacity },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: glass.fillStrong,
    borderRadius: tr.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    padding: ts.lg,
    marginBottom: ts.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ts.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tr.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  lastSynced: {
    fontSize: 11,
    color: tc.textMuted,
  },
  pipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: ts.sm,
  },
  pipTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: glass.track,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pipFill: {
    height: 4,
    borderRadius: 2,
  },
  arcRow: {
    alignItems: 'center',
    height: 20,
    marginBottom: ts.sm,
  },
  arc: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: tc.stable,
    borderRightColor: tc.stable,
  },
  arcTip: {},
  pendingLine: {
    fontSize: 11,
    color: tc.amber,
    marginBottom: ts.sm,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: tc.attention + '11',
    borderRadius: tr.sm,
    padding: ts.sm,
    marginBottom: ts.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 11,
    color: tc.attention,
    lineHeight: 16,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: glass.fill,
    borderRadius: tr.sm,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
  },
  syncBtnDisabled: {
    opacity: 0.5,
  },
  syncBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: tc.textPrimary,
  },
  syncSpinner: {
    // use a rotate animation
  },
  attemptLine: {
    fontSize: 9,
    color: tc.textMuted,
    textAlign: 'center',
    marginTop: ts.xs,
  },
});