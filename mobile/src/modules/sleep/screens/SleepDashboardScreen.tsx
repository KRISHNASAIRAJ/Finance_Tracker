/**
 * SleepDashboardScreen — Sleep tracking dashboard.
 *
 * - One-tap "Going to bed" / "Good morning" (persisted pending session)
 * - Auto-detect card (UsageStatsManager, morning confirm flow)
 * - Duration + quality trends (SVG chart)
 * - History with edit/delete
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Circle, Line } from 'react-native-svg';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useAuth } from '../../../services/AuthProvider';
import {
  useSleepStore,
  SleepEntry,
  sleepDurationHours,
  formatSleepDuration,
} from '../store';
import { detectLastSleep, hasUsageAccess, isSleepDetectAvailable, openUsageAccessSettings, DetectedSleep } from '../sleepDetect';
import { scheduleAllReminders } from '../../../services/notificationService';
import { supabase } from '../../../services/supabaseClient';
import { toLocalInput, parseLocalInput } from './sleepTime';

const STORAGE_KEY = 'meridian_sleep_pending_bedtime';

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

export default function SleepDashboardScreen() {
  const navigation = useNavigation();
  const entries = useSleepStore((s) => s.entries) || [];
  const addEntry = useSleepStore((s) => s.addEntry);
  const editEntry = useSleepStore((s) => s.editEntry);
  const deleteEntry = useSleepStore((s) => s.deleteEntry);
  const { user } = useAuth();

  const [pendingBedtime, setPendingBedtime] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedSleep | null>(null);
  const [detectLoading, setDetectLoading] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [editing, setEditing] = useState<SleepEntry | null>(null);
  const [form, setForm] = useState({ bed: '', wake: '', quality: '', interruptions: '', notes: '' });
  const reminderTime = useSleepStore((s) => s.reminderTime);
  const setReminderTime = useSleepStore((s) => s.setReminderTime);
  const [usageGranted, setUsageGranted] = useState<boolean | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const fetchInsight = async () => {
    if (insightLoading || entries.length === 0) return;
    setInsightLoading(true);
    try {
      const nights = sorted
        .slice(0, 14)
        .reverse()
        .map((e) => ({
          startTime: e.startTime,
          endTime: e.endTime,
          durationHours: sleepDurationHours(e),
          quality: e.quality,
          interruptions: e.interruptions ?? 0,
        }));
      const { data, error } = await supabase.functions.invoke('ai-sleep-insight', {
        body: { nights },
      });
      if (error) throw error;
      setInsight(data?.insight || 'No insight available right now.');
    } catch (e: any) {
      setInsight(`Could not reach AI service: ${e?.message || 'network error'}`);
    } finally {
      setInsightLoading(false);
    }
  };

  // Restore pending bedtime (in-progress sleep session)
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => setPendingBedtime(v))
      .catch(() => {});
  }, []);

  const savePendingBedtime = (iso: string | null) => {
    setPendingBedtime(iso);
    AsyncStorage.setItem(STORAGE_KEY, iso ?? '').catch(() => {});
  };

  // Auto-detect on open (morning suggestion). Fully guarded — any failure
  // just leaves the card hidden; never surfaces an error to the user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isSleepDetectAvailable()) return;
        const granted = await hasUsageAccess();
        if (cancelled || !granted) return;
        // Only suggest if last night isn't already logged
        const lastNightStart = Date.now() - 18 * 3600000;
        const alreadyLogged = (entries || []).some(
          (e) => new Date(e.endTime).getTime() > lastNightStart
        );
        if (alreadyLogged) return;
        setDetectLoading(true);
        const d = await detectLastSleep();
        if (!cancelled) {
          setDetected(d);
          setDetectLoading(false);
        }
      } catch {
        if (!cancelled) setDetectLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // One-shot mount effect: entries snapshot at open time is intentional —
    // re-running on every log would re-trigger detection after the user logs.
  }, []);

  // Track usage-access state for the enable-detect card
  useEffect(() => {
    hasUsageAccess().then(setUsageGranted).catch(() => setUsageGranted(false));
  }, []);

  const changeReminder = (time: { hour: number; minute: number } | null) => {
    setReminderTime(time);
    // Reschedule all reminders so the bedtime nudge takes effect tonight
    scheduleAllReminders().catch(() => {});
  };

  const promptUsageAccess = () => {
    Alert.alert(
      'Enable auto-detect?',
      'Meridian can read screen on/off times (Android "Usage access") to suggest your sleep window each morning. No background service — it only looks when you open this screen.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => openUsageAccessSettings() },
      ]
    );
  };

  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [entries]
  );

  const last7 = useMemo(() => sorted.slice(0, 7).reverse(), [sorted]);
  const avgHours = last7.length > 0
    ? last7.reduce((s, e) => s + sleepDurationHours(e), 0) / last7.length
    : null;
  const latest = sorted[0] ?? null;
  const lastAvg = avgHours ? formatSleepDuration(avgHours) : null;

  // Chart: duration trend (last 7 nights, oldest → newest)
  const CHART_W = 340;
  const CHART_H = 150;
  const padX = 28;
  const padY = 24;
  const durations = last7.map((e) => sleepDurationHours(e));
  const maxD = Math.max(...durations, 9);
  const minD = Math.min(...durations, 4);
  const rangeD = maxD - minD || 1;
  const points = last7.map((e, i) => {
    const x = padX + (i / Math.max(last7.length - 1, 1)) * (CHART_W - 2 * padX);
    const y = CHART_H - padY - ((sleepDurationHours(e) - minD) / rangeD) * (CHART_H - 2 * padY);
    return { x, y, value: sleepDurationHours(e) };
  });
  let pathD = '';
  let fillD = '';
  if (points.length > 1) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const cpx = points[i].x + (points[i + 1].x - points[i].x) / 2;
      pathD += ` C ${cpx} ${points[i].y}, ${cpx} ${points[i + 1].y}, ${points[i + 1].x} ${points[i + 1].y}`;
    }
    fillD = `${pathD} L ${points[points.length - 1].x} ${CHART_H - padY} L ${points[0].x} ${CHART_H - padY} Z`;
  }
  const targetY = CHART_H - padY - ((7.5 - minD) / rangeD) * (CHART_H - 2 * padY);

  const tapBed = () => {
    if (pendingBedtime) {
      Alert.alert(
        'Overwrite bedtime?',
        `You already tapped "Going to bed" ${hoursAgo(pendingBedtime).toFixed(1)}h ago. Start over?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Restart', onPress: () => savePendingBedtime(new Date().toISOString()) },
        ]
      );
    } else {
      savePendingBedtime(new Date().toISOString());
    }
  };

  const tapWake = () => {
    if (!pendingBedtime) return;
    const wake = new Date().toISOString();
    addEntry(
      {
        startTime: pendingBedtime,
        endTime: wake,
        quality: null,
        mood: null,
        interruptions: 0,
        notes: '',
        source: 'manual',
      },
      user?.id
    );
    savePendingBedtime(null);
  };

  const acceptDetected = () => {
    if (!detected) return;
    addEntry(
      {
        startTime: new Date(detected.bedTime).toISOString(),
        endTime: new Date(detected.wakeTime).toISOString(),
        quality: null,
        mood: null,
        interruptions: detected.interruptions,
        notes: '',
        source: 'auto',
      },
      user?.id
    );
    setDetected(null);
  };

  const openAdd = () => {
    setEditing(null);
    const now = new Date();
    const bedDefault = new Date(now.getTime() - 8 * 3600000);
    setForm({
      bed: toLocalInput(bedDefault),
      wake: toLocalInput(now),
      quality: '',
      interruptions: '0',
      notes: '',
    });
    setShowLog(true);
  };

  const openEdit = (e: SleepEntry) => {
    setEditing(e);
    setForm({
      bed: toLocalInput(new Date(e.startTime)),
      wake: toLocalInput(new Date(e.endTime)),
      quality: e.quality ? String(e.quality) : '',
      interruptions: String(e.interruptions ?? 0),
      notes: e.notes || '',
    });
    setShowLog(true);
  };

  const handleSave = () => {
    const bed = parseLocalInput(form.bed);
    const wake = parseLocalInput(form.wake);
    if (!bed || !wake) {
      Alert.alert('Invalid times', 'Enter bedtime and wake time as YYYY-MM-DD HH:MM');
      return;
    }
    if (wake <= bed) {
      Alert.alert('Invalid range', 'Wake time must be after bedtime.');
      return;
    }
    const quality = form.quality ? parseInt(form.quality, 10) : null;
    if (quality !== null && (quality < 1 || quality > 5)) {
      Alert.alert('Invalid quality', 'Quality must be 1–5');
      return;
    }
    const interruptions = Math.max(0, parseInt(form.interruptions, 10) || 0);
    const payload = {
      startTime: bed.toISOString(),
      endTime: wake.toISOString(),
      quality,
      mood: null,
      interruptions,
      notes: form.notes,
      source: editing?.source ?? 'manual',
    };
    if (editing) editEntry(editing.id, payload, user?.id);
    else addEntry(payload, user?.id);
    setShowLog(false);
    setEditing(null);
  };

  const confirmDelete = (e: SleepEntry) => {
    Alert.alert('Delete entry?', 'This sleep log will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(e.id, user?.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.appBarCenter}>
          <Text style={styles.appBarTitle}>Sleep Tracker</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={openAdd}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Auto-detect suggestion */}
        {detectLoading && (
          <View style={styles.detectCard}>
            <Text style={styles.detectTitle}>Checking last night…</Text>
          </View>
        )}
        {!detectLoading && detected && (
          <View style={styles.detectCard}>
            <View style={styles.detectHead}>
              <Ionicons name="moon-outline" size={18} color={colors.primary} />
              <Text style={styles.detectTitle}>Detected last night</Text>
            </View>
            <Text style={styles.detectTimes}>
              {new Date(detected.bedTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}{' '}
              → {new Date(detected.wakeTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              {'  '}({formatSleepDuration((detected.wakeTime - detected.bedTime) / 3600000)})
            </Text>
            <View style={styles.detectActions}>
              <TouchableOpacity style={styles.detectAccept} onPress={acceptDetected}>
                <Text style={styles.detectAcceptText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.detectDismiss} onPress={() => setDetected(null)}>
                <Text style={styles.detectDismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* One-tap session */}
        {!pendingBedtime ? (
          <TouchableOpacity style={styles.bedBtn} onPress={tapBed} activeOpacity={0.85}>
            <Ionicons name="moon" size={22} color={colors.onSurface} />
            <View style={styles.bedBtnTextWrap}>
              <Text style={styles.bedBtnTitle}>Going to bed</Text>
              <Text style={styles.bedBtnSub}>Tap when you're off to sleep</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.wakeWrap}>
            <View style={styles.wakeInfo}>
              <Ionicons name="moon" size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.wakeInfoText}>
                In bed since{' '}
                {new Date(pendingBedtime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </Text>
            </View>
            <TouchableOpacity style={styles.wakeBtn} onPress={tapWake} activeOpacity={0.85}>
              <Ionicons name="sunny" size={22} color={colors.onSurface} />
              <View style={styles.bedBtnTextWrap}>
                <Text style={styles.bedBtnTitle}>Good morning</Text>
                <Text style={styles.bedBtnSub}>Tap when you wake up</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBed} onPress={() => savePendingBedtime(null)}>
              <Text style={styles.cancelBedText}>Cancel session</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hero stats */}
        {latest && (
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>LAST NIGHT</Text>
            <View style={styles.heroRow}>
              <Text style={styles.heroValue}>{formatSleepDuration(sleepDurationHours(latest))}</Text>
            </View>
            <View style={styles.heroMeta}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Bed</Text>
                <Text style={styles.heroStatValue}>
                  {new Date(latest.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Wake</Text>
                <Text style={styles.heroStatValue}>
                  {new Date(latest.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Quality</Text>
                <Text style={styles.heroStatValue}>{latest.quality ? `${latest.quality}/5` : '—'}</Text>
              </View>
            </View>
            {lastAvg && <Text style={styles.avgText}>7-night avg: {lastAvg}</Text>}
          </View>
        )}

        {/* Trend chart */}
        {points.length > 1 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>DURATION — LAST 7 NIGHTS</Text>
            <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
              <Defs>
                <SvgLinearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.25" />
                  <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
                </SvgLinearGradient>
              </Defs>
              <Line x1={padX} y1={targetY} x2={CHART_W - padX} y2={targetY} stroke={colors.success} strokeWidth="1.5" strokeDasharray="6,4" />
              <Path d={fillD} fill="url(#sGrad)" />
              <Path d={pathD} stroke={colors.primary} strokeWidth="2.5" fill="none" strokeLinecap="round" />
              {points.length > 0 && (
                <Circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill={colors.primary} />
              )}
            </Svg>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>Target: 7h 30m</Text>
            </View>
          </View>
        )}

        {/* AI insight */}
        {entries.length > 0 && (
          <View style={styles.insightCard}>
            {insightLoading ? (
              <Text style={styles.insightText}>Thinking…</Text>
            ) : insight ? (
              <Text style={styles.insightText}>{insight}</Text>
            ) : (
              <TouchableOpacity style={styles.insightBtn} onPress={fetchInsight} disabled={insightLoading}>
                <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
                <Text style={styles.insightBtnText}>Get AI sleep insight</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Settings: bedtime reminder + auto-detect */}
        <View style={styles.settingsCard}>
          <View style={styles.settingsRow}>
            <Ionicons name="notifications-outline" size={16} color={colors.primary} />
            <Text style={styles.settingsLabel}>Bedtime reminder</Text>
            <View style={styles.reminderBtns}>
              {[
                { h: 22, m: 30, label: '10:30 PM' },
                { h: 23, m: 0, label: '11:00 PM' },
                { h: 23, m: 30, label: '11:30 PM' },
              ].map((opt) => {
                const active = reminderTime?.hour === opt.h && reminderTime?.minute === opt.m;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.reminderBtn, active && styles.reminderBtnActive]}
                    onPress={() => changeReminder({ hour: opt.h, minute: opt.m })}
                  >
                    <Text style={[styles.reminderBtnText, active && styles.reminderBtnTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {reminderTime && (
                <TouchableOpacity
                  style={styles.reminderOff}
                  onPress={() => changeReminder(null)}
                >
                  <Text style={styles.reminderOffText}>Off</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {isSleepDetectAvailable() && usageGranted === false && (
            <TouchableOpacity style={styles.detectEnable} onPress={promptUsageAccess}>
              <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
              <Text style={styles.detectEnableText}>Enable morning auto-detect</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          )}
        </View>

        {/* History */}
        <Text style={styles.sectionTitle}>HISTORY</Text>
        {sorted.length === 0 ? (
          <Text style={styles.emptyText}>No sleep logs yet. Tap "Going to bed" tonight to start.</Text>
        ) : (
          sorted.map((e) => {
            const d = sleepDurationHours(e);
            const below = d < 6;
            const good = d >= 7;
            return (
              <View key={e.id} style={styles.entryCard}>
                <TouchableOpacity style={styles.entryMain} onPress={() => openEdit(e)} activeOpacity={0.7}>
                  <View style={styles.entryIcon}>
                    <Ionicons name={e.source === 'auto' ? 'sparkles-outline' : 'moon-outline'} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryDate}>
                      {new Date(e.startTime).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </Text>
                    <Text style={styles.entryTimes}>
                      {new Date(e.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} –{' '}
                      {new Date(e.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      {e.interruptions > 0 ? `  ·  ${e.interruptions} wake${e.interruptions > 1 ? 's' : ''}` : ''}
                    </Text>
                    {e.notes ? <Text style={styles.entryNote} numberOfLines={1}>{e.notes}</Text> : null}
                  </View>
                  <View style={styles.entryStats}>
                    <Text style={[styles.entryDur, { color: below ? colors.error : good ? colors.success : colors.onSurface }]}>
                      {formatSleepDuration(d)}
                    </Text>
                    {e.quality ? <Text style={styles.entryQuality}>Q {e.quality}/5</Text> : null}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.entryDelete} onPress={() => confirmDelete(e)}>
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showLog} transparent animationType="slide" onRequestClose={() => setShowLog(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Sleep' : 'Log Sleep Manually'}</Text>

            <Text style={styles.fieldLabel}>Bed time (YYYY-MM-DD HH:MM)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.bed}
              onChangeText={(t) => setForm((f) => ({ ...f, bed: t }))}
              placeholder="e.g. 2026-09-12 23:30"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <Text style={styles.fieldLabel}>Wake time (YYYY-MM-DD HH:MM)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.wake}
              onChangeText={(t) => setForm((f) => ({ ...f, wake: t }))}
              placeholder="e.g. 2026-09-13 07:15"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <Text style={styles.fieldLabel}>Quality (1–5, optional)</Text>
            <View style={styles.qualityRow}>
              {[1, 2, 3, 4, 5].map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.qualityBtn, form.quality === String(q) && styles.qualityBtnActive]}
                  onPress={() => setForm((f) => ({ ...f, quality: f.quality === String(q) ? '' : String(q) }))}
                >
                  <Ionicons name={q <= (parseInt(form.quality, 10) || 0) ? 'star' : 'star-outline'} size={20} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Interruptions (night wakes)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.interruptions}
              onChangeText={(t) => setForm((f) => ({ ...f, interruptions: t.replace(/[^0-9]/g, '') }))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.notes}
              onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))}
              placeholder="Optional"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            {editing ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.saveBtn, { flex: 1, backgroundColor: colors.errorContainer }]}
                  onPress={() => { deleteEntry(editing.id, user?.id); setShowLog(false); }}
                >
                  <Text style={styles.saveBtnText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, { flex: 1 }]} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>Update</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLog(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0 },
  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 64, paddingHorizontal: spacing.containerPadding, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  appBarCenter: { alignItems: 'center' },
  appBarTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  iconBtn: { padding: 8, borderRadius: rounded.full },
  scroll: { padding: spacing.containerPadding, gap: 14, paddingBottom: 40 },

  detectCard: { backgroundColor: colors.primaryContainer, borderRadius: rounded.lg, padding: 16, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  detectHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detectTitle: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
  detectTimes: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
  detectActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  detectAccept: { backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 20, borderRadius: rounded.DEFAULT, alignItems: 'center' },
  detectAcceptText: { fontSize: 13, fontWeight: '700', color: colors.onPrimary },
  detectDismiss: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: rounded.DEFAULT, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: 'center' },
  detectDismissText: { fontSize: 13, fontWeight: '700', color: colors.onSurfaceVariant },

  bedBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.primaryContainer, padding: 18, borderRadius: rounded.lg },
  bedBtnTextWrap: { gap: 2 },
  bedBtnTitle: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  bedBtnSub: { fontSize: 12, color: colors.onSurfaceVariant },
  wakeWrap: { gap: 10 },
  wakeInfo: { flexDirection: 'row', alignItems: 'center', paddingLeft: 4 },
  wakeInfoText: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '600' },
  wakeBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.primaryContainer, padding: 18, borderRadius: rounded.lg },
  cancelBed: { alignItems: 'center', paddingVertical: 6 },
  cancelBedText: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '600' },

  heroCard: { backgroundColor: colors.surface, borderRadius: rounded.lg, padding: 20, alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  heroLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  heroValue: { fontSize: 38, fontWeight: '800', color: colors.onSurface, letterSpacing: -1 },
  heroMeta: { flexDirection: 'row', gap: 24, marginTop: 4 },
  heroStat: { alignItems: 'center', gap: 2 },
  heroStatLabel: { fontSize: 10, color: colors.onSurfaceVariant, fontWeight: '600' },
  heroStatValue: { fontSize: 14, color: colors.onSurface, fontWeight: '700' },
  avgText: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 4 },

  chartCard: { backgroundColor: colors.surface, borderRadius: rounded.lg, padding: 16, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chartTitle: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.onSurfaceVariant },

  insightCard: { backgroundColor: colors.primaryContainer, borderRadius: rounded.lg, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  insightText: { fontSize: 13, color: colors.onSurface, lineHeight: 19 },
  insightBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  insightBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  settingsCard: { backgroundColor: colors.surface, borderRadius: rounded.lg, padding: 14, gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  settingsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  settingsLabel: { fontSize: 12, fontWeight: '600', color: colors.onSurface, marginRight: 4 },
  reminderBtns: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  reminderBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: rounded.DEFAULT, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  reminderBtnActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  reminderBtnText: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant },
  reminderBtnTextActive: { color: colors.onSurface },
  reminderOff: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: rounded.DEFAULT, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.error },
  reminderOffText: { fontSize: 11, fontWeight: '600', color: colors.error },
  detectEnable: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  detectEnableText: { fontSize: 12, fontWeight: '600', color: colors.primary, flex: 1 },

  sectionTitle: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6, marginTop: 4 },
  emptyText: { fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 20 },

  entryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: rounded.DEFAULT, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  entryMain: { flex: 1, flexDirection: 'row', padding: 12, gap: 12, alignItems: 'center' },
  entryIcon: { width: 40, height: 40, borderRadius: rounded.DEFAULT, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  entryInfo: { flex: 1, gap: 2 },
  entryDate: { fontSize: 13, fontWeight: '600', color: colors.onSurface },
  entryTimes: { fontSize: 11, color: colors.onSurfaceVariant },
  entryNote: { fontSize: 11, color: colors.onSurfaceVariant },
  entryStats: { alignItems: 'flex-end', gap: 2 },
  entryDur: { fontSize: 15, fontWeight: '700' },
  entryQuality: { fontSize: 11, color: colors.onSurfaceVariant },
  entryDelete: { padding: 12, paddingLeft: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center', marginBottom: 16 },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6, marginBottom: 4, marginTop: 8 },
  fieldInput: { backgroundColor: colors.surface, borderRadius: rounded.DEFAULT, height: 44, paddingHorizontal: 14, color: colors.onSurface, fontSize: 15, fontWeight: '500', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  qualityRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  qualityBtn: { padding: 8, borderRadius: rounded.DEFAULT, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  qualityBtnActive: { backgroundColor: colors.primaryContainer },
  saveBtn: { backgroundColor: colors.primaryContainer, paddingVertical: 14, borderRadius: rounded.lg, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  cancelBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  cancelBtnText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
});
