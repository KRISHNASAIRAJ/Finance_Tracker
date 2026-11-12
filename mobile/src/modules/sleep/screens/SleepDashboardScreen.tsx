/**
 * SleepDashboardScreen — Sleep tracking dashboard.
 *
 * - One-tap "Going to bed" / "Good morning" (persisted pending session)
 * - Automatic tracking card (accelerometer, smart alarm, live status)
 * - Duration + quality trends (SVG chart)
 * - Compact history + the full log on its own page
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Circle, Line } from 'react-native-svg';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useAuth } from '../../../services/AuthProvider';
import TimePicker from '../../../shared/components/TimePicker';
import {
  useSleepStore,
  SleepEntry,
  sleepDurationHours,
  formatSleepDuration,
} from '../store';
import {
  isSleepMotionAvailable,
  isTrackingTime,
  startMotionTracking,
  stopMotionTracking,
  setMotionConfig,
  getMotionStatus,
  getMotionBuckets,
  type SleepMotionStatus,
  type MotionBucket,
  type SleepSensitivity,
  type SleepAlarmMode,
} from '../sleepMotion';
import {
  inferSleepSession,
  motionThreshold,
  movingSecondsThreshold,
  currentStillness,
  resolvePendingGap,
  type InferredSleep,
} from '../sleepInference';
import { isSameNight } from '../sleepNights';
import { scheduleAllReminders } from '../../../services/notificationService';
import { supabase } from '../../../services/supabaseClient';
import { MoreStackParamList } from '../../../navigation/RootNavigator';
import { toLocalInput, parseLocalInput } from './sleepTime';

type Nav = NativeStackNavigationProp<MoreStackParamList>;

const STORAGE_KEY = 'meridian_sleep_pending_bedtime';

/** A sleep session shorter than this is never accepted as sleep. */
const MIN_SESSION_MIN = 120;

/** "22:30" → "10:30 PM" */
function fmtClock(minutesFromMidnight: number): string {
  const total = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Minutes from midnight → a Date today (for the time picker). */
function dateFromMinutes(minutesFromMidnight: number): Date {
  const d = new Date();
  d.setHours(Math.floor(minutesFromMidnight / 60) % 24, minutesFromMidnight % 60, 0, 0);
  return d;
}

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

export default function SleepDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const entries = useSleepStore((s) => s.entries) || [];
  const addEntry = useSleepStore((s) => s.addEntry);
  const editEntry = useSleepStore((s) => s.editEntry);
  const deleteEntry = useSleepStore((s) => s.deleteEntry);
  const { user } = useAuth();

  const [pendingBedtime, setPendingBedtime] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [editing, setEditing] = useState<SleepEntry | null>(null);
  const [form, setForm] = useState({ bed: '', wake: '', quality: '', interruptions: '', notes: '' });
  const reminderTime = useSleepStore((s) => s.reminderTime);
  const setReminderTime = useSleepStore((s) => s.setReminderTime);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  /** The pending-gap question (a 5–10 minute awake gap inside the night). */
  const [gapPrompt, setGapPrompt] = useState<{ minutes: number } | null>(null);
  const [gapMinutesInput, setGapMinutesInput] = useState('');

  // The sleep log, newest first.
  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [entries]
  );

  // --- automatic (accelerometer) sleep tracking ---
  const autoConfig = useSleepStore((s) => s.autoConfig);
  const setAutoConfig = useSleepStore((s) => s.setAutoConfig);
  const [autoStatus, setAutoStatus] = useState<SleepMotionStatus | null>(null);
  const [autoBuckets, setAutoBuckets] = useState<MotionBucket[]>([]);
  const [autoSession, setAutoSession] = useState<InferredSleep | null>(null);
  const [autoSaved, setAutoSaved] = useState(false);
  const [timePicker, setTimePicker] = useState<
    { kind: 'nightStart' | 'nightEnd' | 'wakeStart' | 'wakeEnd'; value: number } | null
  >(null);
  const autoAvailable = isSleepMotionAvailable();

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
    (async () => {
      try {
        const local = await AsyncStorage.getItem(STORAGE_KEY);
        if (local) {
          setPendingBedtime(local);
        }
      } catch {
        /* best-effort restore */
      }
    })();
    // One-shot mount effect: `user` snapshot at open time is intentional —
    // when auth hasn't resolved yet the ended-session marker stays in
    // SharedPreferences and is adopted on the next open.
  }, []);

  const savePendingBedtime = (iso: string | null) => {
    setPendingBedtime(iso);
    AsyncStorage.setItem(STORAGE_KEY, iso ?? '').catch(() => {});
  };

  // --- automatic (accelerometer) sleep tracking -----------------------------
  // The native tracker keeps running in the background; this screen only reads
  // its timeline, infers the sleep session and offers it to the user.
  const refreshAuto = useCallback(async () => {
    if (!isSleepMotionAvailable()) return;
    const status = await getMotionStatus();
    if (status) setAutoStatus(status);
    const buckets = await getMotionBuckets();
    setAutoBuckets(buckets);
    const inferred = inferSleepSession(buckets, {
      threshold: motionThreshold(autoConfig.sensitivity),
      // The phone can sit under a pillow — a minute only counts as awake when
      // the movement was sustained (see movingSecondsThreshold).
      movingSeconds: movingSecondsThreshold(autoConfig.sensitivity),
      sleepStartMin: autoConfig.sleepStartMin,
      sleepEndMin: autoConfig.sleepEndMin,
      minSessionMin: MIN_SESSION_MIN,
      // A movement inside the wake window is the wake-up, an earlier one is
      // a short interruption.
      wakeStartMin: autoConfig.wakeStartMin,
      wakeEndMin: autoConfig.wakeEndMin,
    });
    setAutoSession(inferred);
    if (!inferred) {
      setAutoSaved(false);
      return;
    }

    const already = (entries || []).some((e) =>
      isSameNight(e, {
        startTime: new Date(inferred.bedTime).toISOString(),
        endTime: new Date(inferred.wakeTime).toISOString(),
      })
    );
    setAutoSaved(already);

    // Auto-save once the session has settled (the phone was picked up).
    // A night with an open question (a 5–10 min gap) waits for the user.
    const settled = Date.now() - inferred.wakeTime > 5 * 60000;
    if (autoConfig.autoSave && settled && !already && !inferred.pendingGap) {
      addEntry(
        {
          startTime: new Date(inferred.bedTime).toISOString(),
          endTime: new Date(inferred.wakeTime).toISOString(),
          quality: null,
          mood: null,
          interruptions: inferred.interruptions,
          notes: 'Detected automatically (motion sensor)',
          source: 'auto-motion',
        },
        user?.id
      );
      setAutoSaved(true);
    }
  }, [autoConfig, entries, addEntry, user?.id]);

  useEffect(() => {
    if (!autoAvailable) return;
    refreshAuto();
    const timer = setInterval(() => {
      refreshAuto();
    }, 30000);
    return () => clearInterval(timer);
  }, [autoAvailable, refreshAuto]);

  /**
   * The live status of the tracker — polled every 5 s (the sensor period), so
   * the "still for" readout keeps up with the phone instead of lagging a whole
   * minute behind.
   */
  const refreshStatus = useCallback(async () => {
    if (!isSleepMotionAvailable()) return;
    const status = await getMotionStatus();
    if (status) setAutoStatus(status);
  }, []);

  useEffect(() => {
    if (!autoAvailable) return;
    refreshStatus();
    const timer = setInterval(() => {
      refreshStatus();
    }, 5000);
    return () => clearInterval(timer);
  }, [autoAvailable, refreshStatus]);

  const toggleAuto = async (next: boolean) => {
    setAutoConfig({ enabled: next });
    if (next) {
      await startMotionTracking({ ...autoConfig, enabled: true });
    } else {
      await stopMotionTracking();
    }
    refreshAuto();
  };

  const changeSensitivity = async (sensitivity: SleepSensitivity) => {
    const next = { ...autoConfig, sensitivity };
    setAutoConfig(next);
    await setMotionConfig(next);
  };

  const toggleAlarm = async (enabled: boolean) => {
    const next = { ...autoConfig, alarmEnabled: enabled };
    setAutoConfig(next);
    await setMotionConfig(next);
  };

  const applyPickedTime = (minutes: number) => {
    if (!timePicker) return;
    const kind = timePicker.kind;
    const next = { ...autoConfig };
    if (kind === 'nightStart') next.sleepStartMin = minutes;
    else if (kind === 'nightEnd') next.sleepEndMin = minutes;
    else if (kind === 'wakeStart') next.wakeStartMin = minutes;
    else next.wakeEndMin = minutes;
    setAutoConfig(next);
    setMotionConfig(next);
    setTimePicker(null);
  };

  const saveDetectedSession = () => {
    if (!autoSession) return;
    addEntry(
      {
        startTime: new Date(autoSession.bedTime).toISOString(),
        endTime: new Date(autoSession.wakeTime).toISOString(),
        quality: null,
        mood: null,
        interruptions: autoSession.interruptions,
        notes: 'Detected automatically (motion sensor)',
        source: 'auto-motion',
      },
      user?.id
    );
    setAutoSaved(true);
  };

  /**
   * The night has a 5–10 minute gap: the user says whether it was a long
   * interruption (and for how long) or the end of the sleep.
   */
  const resolveGap = (resolution: 'interruption' | 'ended', awakeMinutes?: number) => {
    if (!autoSession) return;
    const resolved = resolvePendingGap(autoSession, resolution, awakeMinutes);
    addEntry(
      {
        startTime: new Date(resolved.bedTime).toISOString(),
        endTime: new Date(resolved.wakeTime).toISOString(),
        quality: null,
        mood: null,
        interruptions: resolved.interruptions,
        notes:
          resolution === 'ended'
            ? 'Detected automatically (motion sensor)'
            : 'Detected automatically (motion sensor) · long interruption',
        source: 'auto-motion',
      },
      user?.id
    );
    setAutoSession({ ...resolved, pendingGap: null });
    setAutoSaved(true);
    setGapPrompt(null);
    setGapMinutesInput('');
  };

  const openGapPrompt = () => {
    const minutes = autoSession?.pendingGap?.minutes ?? 5;
    setGapMinutesInput(String(minutes));
    setGapPrompt({ minutes });
  };

  const confirmGapPrompt = () => {
    const typed = parseInt(gapMinutesInput.replace(/[^0-9]/g, ''), 10);
    resolveGap('interruption', Number.isFinite(typed) ? typed : undefined);
  };

  /** Rate the last night out of 5. */
  const rateNight = (entry: SleepEntry, quality: number) => {
    editEntry(entry.id, { quality }, user?.id);
  };

  /**
   * One-tap quick log for the previous night. The length comes from the user's
   * own average (7 hours when there is no history) and the wake time is 7:00
   * AM — so it always logs the night that just passed, never a future one.
   */
  const typicalSleepMs = useMemo(() => {
    const recent = sorted.slice(0, 7);
    if (recent.length === 0) return 7 * 3600000;
    const total = recent.reduce((s, e) => s + sleepDurationHours(e), 0);
    return Math.round((total / recent.length) * 3600000);
  }, [sorted]);

  const quickLogLastNight = () => {
    const wake = new Date();
    wake.setHours(7, 0, 0, 0);
    if (wake.getTime() > Date.now()) {
      // Before 7 AM the night that just ended woke up yesterday.
      wake.setDate(wake.getDate() - 1);
    }
    const bed = new Date(wake.getTime() - typicalSleepMs);
    addEntry(
      {
        startTime: bed.toISOString(),
        endTime: wake.toISOString(),
        quality: null,
        mood: null,
        interruptions: 0,
        notes: 'Quick log — last night',
        source: 'manual',
      },
      user?.id
    );
  };

  const changeReminder = (time: { hour: number; minute: number } | null) => {
    setReminderTime(time);
    // Reschedule all reminders so the bedtime nudge takes effect tonight
    scheduleAllReminders(true).catch(() => {});
  };

  const last7 = useMemo(() => sorted.slice(0, 7).reverse(), [sorted]);
  const avgHours = last7.length > 0
    ? last7.reduce((s, e) => s + sleepDurationHours(e), 0) / last7.length
    : null;
  const latest = sorted[0] ?? null;
  const lastAvg = avgHours ? formatSleepDuration(avgHours) : null;

  // --- automatic tracking status -------------------------------------------
  const autoStatusText = useMemo(() => {
    if (!autoConfig.enabled) return 'Off';
    // NIGHT ONLY: during the day the tracker is not running — it starts when
    // the night window opens.
    if (!isTrackingTime(autoConfig)) {
      return `Starts ${fmtClock(autoConfig.sleepStartMin)}`;
    }
    if (!autoStatus) return 'Starting…';
    return autoStatus.running ? 'Tracking' : 'Paused';
  }, [autoConfig.enabled, autoConfig.sleepStartMin, autoStatus]);

  const stillText = useMemo(() => {
    // Live first: the native tracker knows exactly when the phone last moved,
    // so the readout follows the phone in real time.
    if (autoStatus?.running) {
      if (autoStatus.stillSince <= 0) return '—'; // the phone is moving right now
      const minutes = Math.max(0, Math.floor((Date.now() - autoStatus.stillSince) / 60000));
      if (minutes >= 1) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
      }
    }
    // Fallback: the recorded timeline.
    const streak = currentStillness(
      autoBuckets,
      motionThreshold(autoConfig.sensitivity),
      movingSecondsThreshold(autoConfig.sensitivity)
    );
    if (!streak || streak.minutes < 1) return '—';
    const h = Math.floor(streak.minutes / 60);
    const m = streak.minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, [autoStatus, autoBuckets, autoConfig.sensitivity]);

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

        {/* Rate the last night out of 5 */}
        {latest && !latest.quality && (
          <View style={styles.rateCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rateTitle}>How did you sleep?</Text>
              <Text style={styles.rateSub}>Rate last night out of 5</Text>
            </View>
            <View style={styles.rateStars}>
              {[1, 2, 3, 4, 5].map((q) => (
                <TouchableOpacity
                  key={q}
                  style={styles.rateStarBtn}
                  onPress={() => rateNight(latest, q)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="star-outline" size={26} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Session detected by the motion sensor */}
        {autoAvailable && autoSession && !autoSaved && (
          <View style={styles.autoDetectCard}>
            <View style={styles.detectHead}>
              <Ionicons name="radio-outline" size={18} color={colors.primary} />
              <Text style={styles.detectTitle}>Detected automatically</Text>
            </View>
            <Text style={styles.detectTimes}>
              {new Date(autoSession.bedTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}{' '}
              → {new Date(autoSession.wakeTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              {'  '}({formatSleepDuration(autoSession.durationMin / 60)})
            </Text>
            <Text style={styles.autoDetectMeta}>
              {autoSession.interruptions > 0
                ? `${autoSession.interruptions} wake-up${autoSession.interruptions > 1 ? 's' : ''} · ${Math.round(autoSession.confidence * 100)}% confident`
                : `${Math.round(autoSession.confidence * 100)}% confident`}
            </Text>
            <View style={styles.detectActions}>
              <TouchableOpacity style={styles.detectAccept} onPress={saveDetectedSession}>
                <Text style={styles.detectAcceptText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.detectDismiss} onPress={() => setAutoSession(null)}>
                <Text style={styles.detectDismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* A 5–10 minute awake gap inside the night — the user decides whether
            it was a long interruption or the end of the sleep. */}
        {autoAvailable && autoSession?.pendingGap && (
          <View style={styles.gapCard}>
            <View style={styles.detectHead}>
              <Ionicons name="help-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.detectTitle}>You were up for a while</Text>
            </View>
            <Text style={styles.gapText}>
              Around{' '}
              {new Date(autoSession.pendingGap.startMs).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
              {' — about '}
              {autoSession.pendingGap.minutes} min. Was that a long interruption, or did your sleep end there?
            </Text>
            <View style={styles.detectActions}>
              <TouchableOpacity style={styles.detectAccept} onPress={openGapPrompt}>
                <Text style={styles.detectAcceptText}>Long interruption</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.detectDismiss} onPress={() => resolveGap('ended')}>
                <Text style={styles.detectDismissText}>Sleep ended there</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Automatic tracking (accelerometer) */}
        {autoAvailable && (
          <View style={styles.autoCard}>
            <View style={styles.autoHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.autoTitle}>Automatic tracking</Text>
              </View>
              <Switch
                value={autoConfig.enabled}
                onValueChange={toggleAuto}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: colors.primaryContainer }}
                thumbColor={autoConfig.enabled ? colors.primary : 'rgba(255,255,255,0.5)'}
              />
            </View>

            {autoConfig.enabled ? (
              <>
                <View style={styles.autoStatusRow}>
                  <View style={styles.autoStat}>
                    <Text style={styles.autoStatLabel}>STATUS</Text>
                    <Text style={styles.autoStatValue}>{autoStatusText}</Text>
                  </View>
                  <View style={styles.autoStat}>
                    <Text style={styles.autoStatLabel}>STILL FOR</Text>
                    <Text style={styles.autoStatValue}>{stillText}</Text>
                  </View>
                  {autoStatus?.alarmActive && (
                    <View style={styles.autoStat}>
                      <Text style={styles.autoStatLabel}>ALARM</Text>
                      <Text style={[styles.autoStatValue, { color: colors.error }]}>Ringing</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.autoFieldLabel}>SENSITIVITY</Text>
                <View style={styles.chipRow}>
                  {(['low', 'medium', 'high'] as SleepSensitivity[]).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, autoConfig.sensitivity === s && styles.chipActive]}
                      onPress={() => changeSensitivity(s)}
                    >
                      <Text style={[styles.chipText, autoConfig.sensitivity === s && styles.chipTextActive]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.autoHint}>
                  Medium is best with the phone under a pillow — it needs sustained movement to count as awake.
                </Text>

                <Text style={styles.autoFieldLabel}>NIGHT WINDOW</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => setTimePicker({ kind: 'nightStart', value: autoConfig.sleepStartMin })}
                  >
                    <Text style={styles.chipText}>From {fmtClock(autoConfig.sleepStartMin)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => setTimePicker({ kind: 'nightEnd', value: autoConfig.sleepEndMin })}
                  >
                    <Text style={styles.chipText}>Until {fmtClock(autoConfig.sleepEndMin)}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.autoAlarmRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.autoTitle}>Smart alarm</Text>
                    <Text style={styles.autoSub}>Rings inside the wake window with Stop / Snooze</Text>
                  </View>
                  <Switch
                    value={autoConfig.alarmEnabled}
                    onValueChange={toggleAlarm}
                    trackColor={{ false: 'rgba(255,255,255,0.15)', true: colors.primaryContainer }}
                    thumbColor={autoConfig.alarmEnabled ? colors.primary : 'rgba(255,255,255,0.5)'}
                  />
                </View>

                {autoConfig.alarmEnabled && (
                  <>
                    <Text style={styles.autoFieldLabel}>WAKE WINDOW</Text>
                    <View style={styles.chipRow}>
                      <TouchableOpacity
                        style={styles.chip}
                        onPress={() => setTimePicker({ kind: 'wakeStart', value: autoConfig.wakeStartMin })}
                      >
                        <Text style={styles.chipText}>{fmtClock(autoConfig.wakeStartMin)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.chip}
                        onPress={() => setTimePicker({ kind: 'wakeEnd', value: autoConfig.wakeEndMin })}
                      >
                        <Text style={styles.chipText}>{fmtClock(autoConfig.wakeEndMin)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.chip, autoConfig.alarmMode === 'fixed' && styles.chipActive]}
                        onPress={async () => {
                          const next = {
                            ...autoConfig,
                            alarmMode: (autoConfig.alarmMode === 'fixed'
                              ? 'smart'
                              : 'fixed') as SleepAlarmMode,
                          };
                          setAutoConfig(next);
                          await setMotionConfig(next);
                        }}
                      >
                        <Text style={[styles.chipText, autoConfig.alarmMode === 'fixed' && styles.chipTextActive]}>
                          {autoConfig.alarmMode === 'fixed' ? 'Exact time' : 'Light sleep'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            ) : (
              <Text style={styles.autoHint}>
                Meridian watches your phone's motion overnight and works out when you fell asleep and woke
                up. Nothing leaves the phone.
              </Text>
            )}
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

        {/* Quick log for the previous night (when nothing was tracked) */}
        <TouchableOpacity style={styles.quickLogBtn} onPress={quickLogLastNight} activeOpacity={0.85}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.quickLogTitle}>Log last night</Text>
            <Text style={styles.quickLogSub}>
              {formatSleepDuration(typicalSleepMs / 3600000)} · until 7:00 AM
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceVariant} />
        </TouchableOpacity>

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

        {/* Settings: bedtime reminder */}
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
        </View>

        {/* History — compact, the full list lives on its own page */}
        <View style={styles.historyHead}>
          <Text style={styles.sectionTitle}>HISTORY</Text>
          {sorted.length > 0 && (
            <TouchableOpacity style={styles.historyMore} onPress={() => navigation.navigate('SleepHistory')}>
              <Text style={styles.historyMoreText}>View all ({sorted.length})</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        {sorted.length === 0 ? (
          <Text style={styles.emptyText}>No sleep logs yet. Tap "Going to bed" tonight to start.</Text>
        ) : (
          sorted.slice(0, 5).map((e) => {
            const d = sleepDurationHours(e);
            const below = d < 6;
            const good = d >= 7;
            return (
              <TouchableOpacity
                key={e.id}
                style={styles.compactRow}
                onPress={() => openEdit(e)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={e.source?.startsWith('auto') ? 'sparkles-outline' : 'moon-outline'}
                  size={13}
                  color={colors.primary}
                />
                <Text style={styles.compactDate}>
                  {new Date(e.startTime).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
                <Text style={styles.compactTimes}>
                  {new Date(e.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} –{' '}
                  {new Date(e.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </Text>
                <Text style={[styles.compactDur, { color: below ? colors.error : good ? colors.success : colors.onSurface }]}>
                  {formatSleepDuration(d)}
                </Text>
              </TouchableOpacity>
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
                  onPress={() => {
                    // Never delete a night without asking.
                    Alert.alert(
                      'Delete this sleep record?',
                      'This night will be permanently removed.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => {
                            deleteEntry(editing.id, user?.id);
                            setShowLog(false);
                          },
                        },
                      ]
                    );
                  }}
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

      {/* How long was the interruption? (the gap inside the night) */}
      <Modal
        visible={!!gapPrompt}
        transparent
        animationType="slide"
        onRequestClose={() => setGapPrompt(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Long interruption</Text>
            <Text style={styles.gapText}>
              How long were you up? The awake time is taken out of your sleep.
            </Text>
            <TextInput
              style={styles.fieldInput}
              value={gapMinutesInput}
              onChangeText={(t) => setGapMinutesInput(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="minutes"
              placeholderTextColor={colors.onSurfaceVariant}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={confirmGapPrompt}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setGapPrompt(null)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Night window / wake window picker */}
      <TimePicker
        visible={!!timePicker}
        selected={dateFromMinutes(timePicker?.value ?? 0)}
        onSelect={(d) => applyPickedTime(d.getHours() * 60 + d.getMinutes())}
        onClose={() => setTimePicker(null)}
      />
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

  autoCard: { backgroundColor: colors.surface, borderRadius: rounded.lg, padding: 14, gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  autoHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  autoTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  autoSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  autoHint: { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },
  autoStatusRow: { flexDirection: 'row', gap: 18, paddingVertical: 2 },
  autoStat: { gap: 2 },
  autoStatLabel: { fontSize: 9, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  autoStatValue: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
  autoFieldLabel: { fontSize: 9, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 0.6, marginTop: 4 },
  autoAlarmRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  chipTextActive: { color: colors.onSurface },
  autoDetectCard: { backgroundColor: colors.primaryContainer, borderRadius: rounded.lg, padding: 16, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  autoDetectMeta: { fontSize: 11, color: colors.onSurfaceVariant },
  gapCard: { backgroundColor: colors.surface, borderRadius: rounded.lg, padding: 16, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  gapText: { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },
  rateCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: rounded.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rateTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  rateSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  rateStars: { flexDirection: 'row', gap: 2 },
  rateStarBtn: { padding: 2 },

  sectionTitle: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6, marginTop: 4 },
  historyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  historyMore: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4, paddingHorizontal: 6, borderRadius: rounded.full, backgroundColor: colors.primaryContainer },
  historyMoreText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  compactDate: { fontSize: 12, fontWeight: '700', color: colors.onSurface, width: 78 },
  compactTimes: { flex: 1, fontSize: 11, color: colors.onSurfaceVariant },
  compactDur: { fontSize: 12, fontWeight: '700' },
  quickLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quickLogTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  quickLogSub: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
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
