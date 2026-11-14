/**
 * SleepDashboardScreen — Sleep tracking dashboard.
 *
 * - One-tap "Going to bed" / "Good morning" (persisted pending session)
 * - Automatic tracking card (accelerometer, smart alarm, live status)
 * - Duration + quality trends (SVG chart)
 * - Compact history + the full log on its own page
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
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
import { mc } from '../../../shared/theme/meridian';
import {
  BarChart,
  Card,
  EmptyState,
  Label,
  PressScale,
  Rise,
  Screen,
  SegmentedControl,
  Sparkline,
  Toggle,
} from '../../../shared/components/meridian';

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
   *
   * It also heals the tracker: inside the night window it has to be running,
   * so if the service died (the system killed it, a start was refused) it is
   * started again — at most once a minute.
   */
  const lastRestartRef = useRef(0);
  const refreshStatus = useCallback(async () => {
    if (!isSleepMotionAvailable()) return;
    const status = await getMotionStatus();
    if (status) setAutoStatus(status);
    if (!autoConfig.enabled || !isTrackingTime(autoConfig)) return;
    if (!status || status.running) return;
    const now = Date.now();
    if (now - lastRestartRef.current < 60000) return;
    lastRestartRef.current = now;
    await startMotionTracking({ ...autoConfig, enabled: true });
  }, [autoConfig]);

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
    <Screen bottomInset={40}>
      {/* Header — back, title, add */}
      <Rise index={0}>
        <View style={styles.appBar}>
          <PressScale onPress={() => navigation.goBack()} scale={0.9} style={styles.iconButton} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={19} color={mc.text} />
          </PressScale>
          <Text style={styles.appBarTitle}>Sleep tracker</Text>
          <PressScale onPress={openAdd} scale={0.9} style={styles.addBtn} accessibilityLabel="Log sleep">
            <Ionicons name="add" size={19} color={mc.ink} />
          </PressScale>
        </View>
      </Rise>

      {/* Rate last night out of 5 */}
      {latest && !latest.quality && (
        <Rise index={1}>
          <Card>
            <View style={styles.rateRow}>
              <View style={styles.rateMain}>
                <Text style={styles.rateTitle}>How did you sleep?</Text>
                <Text style={styles.rateSub}>Rate last night out of 5</Text>
              </View>
              <View style={styles.rateStars}>
                {[1, 2, 3, 4, 5].map((q) => (
                  <PressScale key={q} onPress={() => rateNight(latest, q)} scale={0.85} accessibilityLabel={`${q} star${q === 1 ? '' : 's'}`}>
                    <Ionicons name="star-outline" size={24} color={mc.violet} />
                  </PressScale>
                ))}
              </View>
            </View>
          </Card>
        </Rise>
      )}

      {/* Last night hero */}
      {latest && (
        <Rise index={2}>
          <Card tone="violet">
            <Label color={mc.violet}>LAST NIGHT</Label>
            <Text style={styles.heroValue}>{formatSleepDuration(sleepDurationHours(latest))}</Text>
            {last7.length > 1 && (
              <Sparkline
                data={last7.map((e) => sleepDurationHours(e))}
                width={120}
                height={38}
                color={mc.violet}
              />
            )}
            <View style={styles.heroMeta}>
              <View style={styles.heroMetaItem}>
                <Text style={styles.heroMetaLabel}>Bed</Text>
                <Text style={styles.heroMetaValue}>
                  {new Date(latest.startTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </Text>
              </View>
              <View style={styles.heroMetaItem}>
                <Text style={styles.heroMetaLabel}>Wake</Text>
                <Text style={styles.heroMetaValue}>
                  {new Date(latest.endTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </Text>
              </View>
              <View style={styles.heroMetaItem}>
                <Text style={styles.heroMetaLabel}>Quality</Text>
                <Text style={styles.heroMetaValue}>{latest.quality ? `${latest.quality}/5` : '—'}</Text>
              </View>
            </View>
            {lastAvg && <Text style={styles.avgText}>7-night average: {lastAvg}</Text>}
          </Card>
        </Rise>
      )}

      {/* Session detected by the motion sensor */}
      {autoAvailable && autoSession && !autoSaved && (
        <Rise index={3}>
          <Card>
            <View style={styles.detectHead}>
              <Ionicons name="radio-outline" size={17} color={mc.violet} />
              <Text style={styles.detectTitle}>Detected automatically</Text>
            </View>
            <Text style={styles.detectTimes}>
              {new Date(autoSession.bedTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
              {' → '}
              {new Date(autoSession.wakeTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
              {'  '}
              <Text style={styles.detectDuration}>({formatSleepDuration(autoSession.durationMin / 60)})</Text>
            </Text>
            <Text style={styles.detectMeta}>
              {autoSession.interruptions > 0
                ? `${autoSession.interruptions} wake-up${autoSession.interruptions > 1 ? 's' : ''} · ${Math.round(autoSession.confidence * 100)}% confident`
                : `${Math.round(autoSession.confidence * 100)}% confident`}
            </Text>
            <View style={styles.detectActions}>
              <PressScale onPress={saveDetectedSession} scale={0.95} style={styles.detectAccept}>
                <Text style={styles.detectAcceptText}>Save</Text>
              </PressScale>
              <PressScale onPress={() => setAutoSession(null)} scale={0.95} style={styles.detectDismiss}>
                <Text style={styles.detectDismissText}>Dismiss</Text>
              </PressScale>
            </View>
          </Card>
        </Rise>
      )}

      {/* A 5–10 minute awake gap inside the night */}
      {autoAvailable && autoSession?.pendingGap && (
        <Rise index={3}>
          <Card>
            <View style={styles.detectHead}>
              <Ionicons name="help-circle-outline" size={17} color={mc.amber} />
              <Text style={styles.detectTitle}>You were up for a while</Text>
            </View>
            <Text style={styles.gapText}>
              Around{' '}
              {new Date(autoSession.pendingGap.startMs).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
              {' — about '}
              {autoSession.pendingGap.minutes} min. Was that a long interruption, or did your sleep end there?
            </Text>
            <View style={styles.detectActions}>
              <PressScale onPress={openGapPrompt} scale={0.95} style={styles.detectAccept}>
                <Text style={styles.detectAcceptText}>Long interruption</Text>
              </PressScale>
              <PressScale onPress={() => resolveGap('ended')} scale={0.95} style={styles.detectDismiss}>
                <Text style={styles.detectDismissText}>Sleep ended there</Text>
              </PressScale>
            </View>
          </Card>
        </Rise>
      )}

      {/* Last 7 nights */}
      {last7.length > 1 && (
        <Rise index={4}>
          <Card>
            <View style={styles.rowBetween}>
              <Label>LAST 7 NIGHTS</Label>
              <Text style={styles.rowValue}>Avg {lastAvg}</Text>
            </View>
            <BarChart
              data={last7.map((e) => {
                const d = sleepDurationHours(e);
                return {
                  label: new Date(e.startTime).toLocaleDateString('en-IN', { weekday: 'narrow' }),
                  value: d,
                  color: d < 6 ? mc.redSoft : mc.violet,
                };
              })}
              width={300}
              height={100}
              reference={7.5}
              referenceColor={mc.mint}
              style={styles.chart}
            />
            <View style={styles.chartFoot}>
              <Text style={styles.chartFootText}>{new Date(last7[0].startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
              <Text style={[styles.chartFootText, { color: mc.mint }]}>target 7h 30m</Text>
              <Text style={[styles.chartFootText, { color: mc.mint }]}>
                {new Date(last7[last7.length - 1].startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          </Card>
        </Rise>
      )}

      {/* Automatic tracking */}
      {autoAvailable && (
        <Rise index={5}>
          <Card>
            <View style={styles.autoHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.autoTitle}>Automatic tracking</Text>
                <Text style={styles.autoSub}>{autoStatusText}</Text>
              </View>
              <Toggle
                value={autoConfig.enabled}
                onChange={toggleAuto}
                accessibilityLabel="Automatic tracking"
              />
            </View>

            {autoConfig.enabled && (
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
                      <Text style={[styles.autoStatValue, { color: mc.redSoft }]}>Ringing</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.autoFieldLabel}>SENSITIVITY</Text>
                <SegmentedControl
                  options={['low', 'medium', 'high'].map((s) => ({
                    key: s,
                    label: s.charAt(0).toUpperCase() + s.slice(1),
                  }))}
                  value={autoConfig.sensitivity}
                  onChange={(v) => changeSensitivity(v as SleepSensitivity)}
                  accent={mc.violet}
                  activeText={mc.ink}
                />
                <Text style={styles.autoHint}>
                  Medium is best with the phone under a pillow — it needs sustained movement to count as awake.
                </Text>

                <Text style={styles.autoFieldLabel}>NIGHT WINDOW</Text>
                <View style={styles.chipRow}>
                  <PressScale
                    onPress={() => setTimePicker({ kind: 'nightStart', value: autoConfig.sleepStartMin })}
                    scale={0.95}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>From {fmtClock(autoConfig.sleepStartMin)}</Text>
                  </PressScale>
                  <PressScale
                    onPress={() => setTimePicker({ kind: 'nightEnd', value: autoConfig.sleepEndMin })}
                    scale={0.95}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>Until {fmtClock(autoConfig.sleepEndMin)}</Text>
                  </PressScale>
                </View>

                <View style={styles.autoAlarmRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.autoTitle}>Smart alarm</Text>
                    <Text style={styles.autoSub}>Rings inside the wake window with Stop / Snooze</Text>
                  </View>
                  <Toggle
                    value={autoConfig.alarmEnabled}
                    onChange={toggleAlarm}
                    accessibilityLabel="Smart alarm"
                  />
                </View>

                {autoConfig.alarmEnabled && (
                  <>
                    <Text style={styles.autoFieldLabel}>WAKE WINDOW</Text>
                    <View style={styles.chipRow}>
                      <PressScale
                        onPress={() => setTimePicker({ kind: 'wakeStart', value: autoConfig.wakeStartMin })}
                        scale={0.95}
                        style={styles.chip}
                      >
                        <Text style={styles.chipText}>{fmtClock(autoConfig.wakeStartMin)}</Text>
                      </PressScale>
                      <PressScale
                        onPress={() => setTimePicker({ kind: 'wakeEnd', value: autoConfig.wakeEndMin })}
                        scale={0.95}
                        style={styles.chip}
                      >
                        <Text style={styles.chipText}>{fmtClock(autoConfig.wakeEndMin)}</Text>
                      </PressScale>
                      <PressScale
                        onPress={async () => {
                          const next = {
                            ...autoConfig,
                            alarmMode: (autoConfig.alarmMode === 'fixed' ? 'smart' : 'fixed') as SleepAlarmMode,
                          };
                          setAutoConfig(next);
                          await setMotionConfig(next);
                        }}
                        scale={0.95}
                        style={[styles.chip, autoConfig.alarmMode === 'fixed' && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, autoConfig.alarmMode === 'fixed' && styles.chipTextActive]}>
                          {autoConfig.alarmMode === 'fixed' ? 'Exact time' : 'Light sleep'}
                        </Text>
                      </PressScale>
                    </View>
                  </>
                )}
              </>
            )}
          </Card>
        </Rise>
      )}

      {/* Going to bed / good morning */}
      {!pendingBedtime ? (
        <Rise index={6}>
          <PressScale onPress={tapBed} scale={0.97} style={styles.bedBtn} accessibilityLabel="Going to bed">
            <Ionicons name="moon" size={22} color={mc.ink} />
            <View style={styles.bedBtnTextWrap}>
              <Text style={styles.bedBtnTitle}>Going to bed</Text>
              <Text style={styles.bedBtnSub}>Tap when you are off to sleep</Text>
            </View>
          </PressScale>
        </Rise>
      ) : (
        <Rise index={6}>
          <View style={styles.wakeWrap}>
            <View style={styles.wakeInfo}>
              <Ionicons name="moon" size={16} color={mc.violet} style={{ marginRight: 8 }} />
              <Text style={styles.wakeInfoText}>
                In bed since{' '}
                {new Date(pendingBedtime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </Text>
            </View>
            <PressScale onPress={tapWake} scale={0.97} style={styles.bedBtn} accessibilityLabel="Good morning">
              <Ionicons name="sunny" size={22} color={mc.ink} />
              <View style={styles.bedBtnTextWrap}>
                <Text style={styles.bedBtnTitle}>Good morning</Text>
                <Text style={styles.bedBtnSub}>Tap when you wake up</Text>
              </View>
            </PressScale>
            <PressScale onPress={() => savePendingBedtime(null)} scale={0.96} style={styles.cancelBed}>
              <Text style={styles.cancelBedText}>Cancel session</Text>
            </PressScale>
          </View>
        </Rise>
      )}

      {/* Quick log */}
      <Rise index={7}>
        <PressScale onPress={quickLogLastNight} scale={0.98} style={styles.quickLogBtn} accessibilityLabel="Log last night">
          <Ionicons name="checkmark-circle-outline" size={17} color={mc.violet} />
          <View style={styles.quickLogMain}>
            <Text style={styles.quickLogTitle}>Log last night</Text>
            <Text style={styles.quickLogSub}>
              {formatSleepDuration(typicalSleepMs / 3600000)} · until 7:00 AM
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={mc.textFaint} />
        </PressScale>
      </Rise>

      {/* AI insight */}
      {entries.length > 0 && (
        <Rise index={8}>
          <Card>
            {insightLoading ? (
              <Text style={styles.insightText}>Thinking…</Text>
            ) : insight ? (
              <Text style={styles.insightText}>{insight}</Text>
            ) : (
              <PressScale onPress={fetchInsight} scale={0.97} style={styles.insightBtn} accessibilityLabel="Get AI sleep insight">
                <Ionicons name="sparkles-outline" size={16} color={mc.violet} />
                <Text style={styles.insightBtnText}>Get AI sleep insight</Text>
              </PressScale>
            )}
          </Card>
        </Rise>
      )}

      {/* Bedtime reminder */}
      <Rise index={9}>
        <Card>
          <View style={styles.settingsRow}>
            <Ionicons name="notifications-outline" size={16} color={mc.violet} />
            <Text style={styles.settingsLabel}>Bedtime reminder</Text>
            <View style={styles.reminderBtns}>
              {[
                { h: 22, m: 30, label: '10:30 PM' },
                { h: 23, m: 0, label: '11:00 PM' },
                { h: 23, m: 30, label: '11:30 PM' },
              ].map((opt) => {
                const active = reminderTime?.hour === opt.h && reminderTime?.minute === opt.m;
                return (
                  <PressScale
                    key={opt.label}
                    onPress={() => changeReminder({ hour: opt.h, minute: opt.m })}
                    scale={0.94}
                    style={[styles.reminderBtn, active && styles.reminderBtnActive]}
                  >
                    <Text style={[styles.reminderBtnText, active && styles.reminderBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </PressScale>
                );
              })}
              {reminderTime && (
                <PressScale onPress={() => changeReminder(null)} scale={0.94} style={styles.reminderOff}>
                  <Text style={styles.reminderOffText}>Off</Text>
                </PressScale>
              )}
            </View>
          </View>
        </Card>
      </Rise>

      {/* HISTORY */}
      <Rise index={10}>
        <View style={styles.historyHead}>
          <Label>HISTORY</Label>
          {sorted.length > 0 && (
            <PressScale onPress={() => navigation.navigate('SleepHistory')} scale={0.95} style={styles.historyMoreBtn}>
              <Text style={styles.historyMoreText}>View all ({sorted.length})</Text>
              <Ionicons name="chevron-forward" size={13} color={mc.violet} />
            </PressScale>
          )}
        </View>
        {sorted.length === 0 ? (
          <EmptyState
            icon="moon-outline"
            title="No sleep logs yet"
            subtitle="Tap &quot;Going to bed&quot; tonight to start"
          />
        ) : (
          sorted.slice(0, 5).map((e) => {
            const d = sleepDurationHours(e);
            const below = d < 6;
            const good = d >= 7;
            return (
              <PressScale key={e.id} onPress={() => openEdit(e)} scale={0.99} style={styles.compactRow}>
                <Ionicons
                  name={e.source?.startsWith('auto') ? 'sparkles-outline' : 'moon-outline'}
                  size={15}
                  color={mc.violet}
                />
                <View style={styles.compactMain}>
                  <Text style={styles.compactDate}>
                    {new Date(e.startTime).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                  <Text style={styles.compactTimes}>
                    {new Date(e.startTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}{' – '}
                    {new Date(e.endTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </Text>
                </View>
                <Text style={[styles.compactDur, { color: below ? mc.redSoft : good ? mc.mint : mc.text }]}>
                  {formatSleepDuration(d)}
                </Text>
              </PressScale>
            );
          })
        )}
      </Rise>

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
              placeholderTextColor={mc.textDim}
            />

            <Text style={styles.fieldLabel}>Wake time (YYYY-MM-DD HH:MM)</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.wake}
              onChangeText={(t) => setForm((f) => ({ ...f, wake: t }))}
              placeholder="e.g. 2026-09-13 07:15"
              placeholderTextColor={mc.textDim}
            />

            <Text style={styles.fieldLabel}>Quality (1–5, optional)</Text>
            <View style={styles.qualityRow}>
              {[1, 2, 3, 4, 5].map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.qualityBtn, form.quality === String(q) && styles.qualityBtnActive]}
                  onPress={() => setForm((f) => ({ ...f, quality: f.quality === String(q) ? '' : String(q) }))}
                >
                  <Ionicons name={q <= (parseInt(form.quality, 10) || 0) ? 'star' : 'star-outline'} size={20} color={mc.violet} />
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
              placeholderTextColor={mc.textDim}
            />

            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.notes}
              onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))}
              placeholder="Optional"
              placeholderTextColor={mc.textDim}
            />

            {editing ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.saveBtn, { flex: 1, backgroundColor: mc.redDim }]}
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
              placeholderTextColor={mc.textDim}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '500',
    color: mc.text,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mc.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rateMain: {
    flex: 1,
  },
  rateTitle: {
    fontSize: 15,
    color: mc.text,
  },
  rateSub: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 2,
  },
  rateStars: {
    flexDirection: 'row',
    gap: 6,
  },

  heroValue: {
    fontSize: 40,
    fontWeight: '500',
    color: mc.text,
    marginVertical: 4,
  },
  heroMeta: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(155,140,255,0.25)',
    paddingTop: 10,
  },
  heroMetaItem: {
    flex: 1,
  },
  heroMetaLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: mc.textDim,
    textTransform: 'uppercase',
  },
  heroMetaValue: {
    fontSize: 13,
    color: mc.text,
    marginTop: 2,
  },
  avgText: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 10,
  },

  detectHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detectTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: mc.text,
  },
  detectTimes: {
    fontSize: 14,
    color: mc.text,
    fontWeight: '500',
    marginTop: 6,
  },
  detectDuration: {
    color: mc.textDim,
    fontWeight: '400',
  },
  detectMeta: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 4,
  },
  detectActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  detectAccept: {
    backgroundColor: mc.violet,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
    alignItems: 'center',
  },
  detectAcceptText: {
    fontSize: 13,
    color: mc.ink,
    fontWeight: '600',
  },
  detectDismiss: {
    backgroundColor: mc.raised,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
    alignItems: 'center',
  },
  detectDismissText: {
    fontSize: 13,
    color: mc.text,
  },
  gapText: {
    fontSize: 13,
    color: mc.textDim,
    lineHeight: 18,
    marginTop: 6,
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 12,
    color: mc.textDim,
  },
  chart: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  chartFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  chartFootText: {
    fontSize: 11,
    color: mc.textDim,
  },

  autoHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  autoTitle: {
    fontSize: 15,
    color: mc.text,
    fontWeight: '500',
  },
  autoSub: {
    fontSize: 12,
    color: mc.textDim,
    marginTop: 2,
  },
  autoStatusRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 12,
  },
  autoStat: {
    flex: 1,
  },
  autoStatLabel: {
    fontSize: 10,
    color: mc.textFaint,
    letterSpacing: 1,
  },
  autoStatValue: {
    fontSize: 14,
    color: mc.text,
    marginTop: 2,
    fontWeight: '500',
  },
  autoFieldLabel: {
    fontSize: 10,
    color: mc.textFaint,
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 6,
  },
  autoHint: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  chip: {
    backgroundColor: mc.raised,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  chipActive: {
    backgroundColor: mc.violetDim,
  },
  chipText: {
    fontSize: 13,
    color: mc.textDim,
  },
  chipTextActive: {
    color: mc.violet,
  },
  autoAlarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },

  bedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: mc.violet,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  bedBtnTextWrap: {
    flex: 1,
  },
  bedBtnTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.ink,
  },
  bedBtnSub: {
    fontSize: 12,
    color: mc.ink,
    opacity: 0.75,
    marginTop: 2,
  },
  wakeWrap: {
    gap: 10,
  },
  wakeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wakeInfoText: {
    fontSize: 13,
    color: mc.textDim,
  },
  cancelBed: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  cancelBedText: {
    fontSize: 13,
    color: mc.redSoft,
  },

  quickLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: mc.card,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quickLogMain: {
    flex: 1,
    minWidth: 0,
  },
  quickLogTitle: {
    fontSize: 14,
    color: mc.text,
  },
  quickLogSub: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },

  insightText: {
    fontSize: 13,
    color: mc.text,
    lineHeight: 18,
  },
  insightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  insightBtnText: {
    fontSize: 13,
    color: mc.violet,
    fontWeight: '600',
  },

  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsLabel: {
    fontSize: 14,
    color: mc.text,
    marginRight: 'auto',
  },
  reminderBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  reminderBtn: {
    backgroundColor: mc.raised,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
  },
  reminderBtnActive: {
    backgroundColor: mc.violet,
  },
  reminderBtnText: {
    fontSize: 12,
    color: mc.textDim,
  },
  reminderBtnTextActive: {
    color: mc.ink,
    fontWeight: '600',
  },
  reminderOff: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reminderOffText: {
    fontSize: 12,
    color: mc.redSoft,
  },

  historyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyMoreText: {
    fontSize: 12,
    color: mc.violet,
    fontWeight: '600',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mc.line,
  },
  compactMain: {
    flex: 1,
    minWidth: 0,
  },
  compactDate: {
    fontSize: 14,
    color: mc.text,
  },
  compactTimes: {
    fontSize: 11,
    color: mc.textDim,
    marginTop: 2,
  },
  compactDur: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: mc.textDim,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: mc.overlay,
    justifyContent: 'center',
    padding: 22,
  },
  modalSheet: {
    backgroundColor: mc.card,
    borderRadius: 26,
    padding: 20,
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: mc.text,
  },
  fieldLabel: {
    fontSize: 12,
    color: mc.textDim,
  },
  fieldInput: {
    backgroundColor: mc.raised,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: mc.text,
    fontSize: 14,
  },
  qualityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  qualityBtn: {
    padding: 6,
    borderRadius: 12,
  },
  qualityBtnActive: {
    backgroundColor: mc.violetDim,
  },
  saveBtn: {
    backgroundColor: mc.violet,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  saveBtnText: {
    fontSize: 14,
    color: mc.ink,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    color: mc.textDim,
  },
});
