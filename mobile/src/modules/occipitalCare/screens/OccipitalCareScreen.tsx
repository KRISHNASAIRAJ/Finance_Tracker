/**
 * OccipitalCareScreen — daily, animated self-care for occipital neuralgia.
 *
 * Three tabs: guided exercises with looping animated demos, a daily habit
 * checklist (with pain log and streaks), and a short educational guide.
 * All data is local and offline-first via OccipitalCareStore.
 *
 * Educational only — not medical advice. See DISCLAIMER in careData.ts.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import type { MoreStackParamList } from '../../../navigation/RootNavigator';
import {
  alpha,
  mc,
  mr,
  mtx,
  mv,
} from '../../../shared/theme/meridian';
import {
  Card,
  Label,
  PressScale,
  Ring,
  Rise,
  Screen,
  SegmentedControl,
} from '../../../shared/components/meridian';
import {
  CAUSES,
  DISCLAIMER,
  EXERCISES,
  FOODS_HELP,
  FOODS_LIMIT,
  HABITS,
  HABIT_GROUPS,
  RED_FLAGS,
  careProgress,
  careStreak,
  careDayFor,
  todayCareKey,
  type CareHabit,
  type ExerciseDef,
} from '../careData';
import { useOccipitalCareStore } from '../store';
import ExerciseDemo from '../components/ExerciseDemo';

type Nav = NativeStackNavigationProp<MoreStackParamList>;
type Tab = 'exercises' | 'habits' | 'guide';

const TABS = [
  { key: 'exercises', label: 'Exercises' },
  { key: 'habits', label: 'Daily habits' },
  { key: 'guide', label: 'Guide' },
];

const PAIN_LEVELS = [0, 2, 4, 6, 8, 10];

function Bullets({ items, color = mc.text }: { items: string[]; color?: string }) {
  return (
    <View style={styles.bullets}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={[styles.bulletDot, { backgroundColor: color }]} />
          <Text style={[styles.bulletText, { color }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function CheckRow({
  label,
  emoji,
  done,
  streak,
  onPress,
}: {
  label: string;
  emoji: string;
  done: boolean;
  streak: number;
  onPress: () => void;
}) {
  return (
    <PressScale onPress={onPress} scale={0.98} style={styles.checkRow} accessibilityRole="checkbox">
      <View style={[styles.checkBox, done && styles.checkBoxDone]}>
        {done ? <Ionicons name="checkmark" size={13} color={mc.ink} /> : null}
      </View>
      <Text style={styles.checkEmoji}>{emoji}</Text>
      <Text style={[styles.checkLabel, done && styles.checkLabelDone]} numberOfLines={2}>
        {label}
      </Text>
      {streak >= 3 ? (
        <View style={styles.streakPill}>
          <Ionicons name="flame" size={11} color={mv.warning} />
          <Text style={styles.streakText}>{streak}</Text>
        </View>
      ) : null}
    </PressScale>
  );
}

function ExerciseCard({
  exercise,
  index,
  done,
  paused,
  onToggle,
  onTogglePause,
}: {
  exercise: ExerciseDef;
  index: number;
  done: boolean;
  paused: boolean;
  onToggle: () => void;
  onTogglePause: () => void;
}) {
  return (
    <Rise index={index}>
      <Card>
        <View style={styles.exerciseHead}>
          <ExerciseDemo motion={exercise.motion} playing={!paused} />
          <View style={styles.exerciseHeadText}>
            <Label color={mv.good}>GENTLE MOVEMENT</Label>
            <Text style={mtx.titleSm}>{exercise.title}</Text>
            <Text style={styles.exerciseSub}>{exercise.subtitle}</Text>
            <View style={styles.dosePill}>
              <Ionicons name="time-outline" size={11} color={mc.amber} />
              <Text style={styles.doseText}>{exercise.dose}</Text>
            </View>
          </View>
        </View>

        <View style={styles.steps}>
          {exercise.steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cautionBox}>
          <Ionicons name="warning-outline" size={13} color={mv.warning} />
          <Text style={styles.cautionText}>{exercise.caution}</Text>
        </View>

        <View style={styles.exerciseActions}>
          <PressScale onPress={onTogglePause} scale={0.94} style={styles.smallBtn}>
            <Ionicons name={paused ? 'play' : 'pause'} size={13} color={mc.textDim} />
            <Text style={styles.smallBtnText}>{paused ? 'Play demo' : 'Pause demo'}</Text>
          </PressScale>
          <PressScale onPress={onToggle} scale={0.96} style={[styles.doneBtn, done && styles.doneBtnOn]}>
            <Ionicons
              name={done ? 'checkmark-circle' : 'ellipse-outline'}
              size={15}
              color={done ? mc.ink : mc.text}
            />
            <Text style={[styles.doneBtnText, done && styles.doneBtnTextOn]}>
              {done ? 'Done today' : 'Mark done'}
            </Text>
          </PressScale>
        </View>
      </Card>
    </Rise>
  );
}

export default function OccipitalCareScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<Tab>('exercises');
  const [paused, setPaused] = useState<Record<string, boolean>>({});

  const days = useOccipitalCareStore((s) => s.days);
  const toggle = useOccipitalCareStore((s) => s.toggle);
  const setPain = useOccipitalCareStore((s) => s.setPain);

  const today = todayCareKey();
  const day = useMemo(() => careDayFor(days, today), [days, today]);
  const done = day?.done ?? [];
  const progress = careProgress(done);
  const doneCount = done.filter((k) => [...EXERCISES.map((e) => e.key), ...HABITS.map((h) => h.key)].includes(k)).length;

  const habitsByGroup = useMemo(() => {
    const map = new Map<string, CareHabit[]>();
    for (const group of HABIT_GROUPS) {
      map.set(group, HABITS.filter((h) => h.group === group));
    }
    return map;
  }, []);

  return (
    <Screen bottomInset={40}>
      {/* Header */}
      <Rise index={0}>
        <View style={styles.appBar}>
          <PressScale
            onPress={() => navigation.goBack()}
            scale={0.9}
            style={styles.iconButton}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={19} color={mc.text} />
          </PressScale>
          <Text style={styles.appBarTitle}>Occipital care</Text>
          <View style={styles.iconSpacer} />
        </View>
      </Rise>

      {/* Today progress + pain log */}
      <Rise index={1}>
        <Card tone="mint">
          <View style={styles.todayRow}>
            <Ring progress={progress} size={62} stroke={7} color={mv.good}>
              <Text style={styles.ringText}>{Math.round(progress * 100)}%</Text>
            </Ring>
            <View style={styles.todayText}>
              <Label color={mv.good}>TODAY'S CARE</Label>
              <Text style={styles.todayBig}>{doneCount} of {HABITS.length} habits</Text>
              <Text style={styles.todaySub}>Small steps, every day. Be gentle with your neck.</Text>
            </View>
          </View>

          <View style={styles.painBlock}>
            <Text style={styles.painLabel}>PAIN RIGHT NOW (0–10)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.painChips}>
                {PAIN_LEVELS.map((level) => {
                  const active = day?.pain === level;
                  return (
                    <PressScale
                      key={level}
                      onPress={() => setPain(today, level)}
                      scale={0.9}
                      style={[styles.painChip, active && styles.painChipOn]}
                    >
                      <Text style={[styles.painChipText, active && styles.painChipTextOn]}>
                        {level}
                      </Text>
                    </PressScale>
                  );
                })}
                {day?.pain !== null && day?.pain !== undefined ? (
                  <PressScale onPress={() => setPain(today, null)} scale={0.9} style={styles.clearPain}>
                    <Text style={styles.clearPainText}>Clear</Text>
                  </PressScale>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </Card>
      </Rise>

      <Rise index={2}>
        <SegmentedControl
          options={TABS}
          value={tab}
          onChange={(key) => setTab(key as Tab)}
          accent={mv.good}
          activeText={mc.ink}
        />
      </Rise>

      {/* EXERCISES */}
      {tab === 'exercises' ? (
        <>
          <Rise index={3}>
            <Card tone="violet">
              <Label color={mc.violet}>HOW TO USE THIS</Label>
              <Text style={styles.introText}>
                Watch the animated figure, then follow the written steps slowly.
                Movement should be gentle and pain-free — never force your neck.
                Tick each one when you finish.
              </Text>
            </Card>
          </Rise>
          {EXERCISES.map((exercise, i) => (
            <ExerciseCard
              key={exercise.key}
              exercise={exercise}
              index={i + 4}
              done={done.includes(exercise.key)}
              paused={Boolean(paused[exercise.key])}
              onToggle={() => toggle(today, exercise.key)}
              onTogglePause={() =>
                setPaused((prev) => ({ ...prev, [exercise.key]: !prev[exercise.key] }))
              }
            />
          ))}
        </>
      ) : null}

      {/* DAILY HABITS */}
      {tab === 'habits' ? (
        <Rise index={3}>
          <Card>
            <Label color={mv.good}>TODAY · {today}</Label>
            {HABIT_GROUPS.map((group) => (
              <View key={group} style={styles.habitGroup}>
                <Text style={styles.groupTitle}>{group.toUpperCase()}</Text>
                {(habitsByGroup.get(group) ?? []).map((habit) => (
                  <CheckRow
                    key={habit.key}
                    label={habit.label}
                    emoji={habit.emoji}
                    done={done.includes(habit.key)}
                    streak={careStreak(days, habit.key)}
                    onPress={() => toggle(today, habit.key)}
                  />
                ))}
              </View>
            ))}
          </Card>
        </Rise>
      ) : null}

      {/* GUIDE */}
      {tab === 'guide' ? (
        <>
          <Rise index={3}>
            <Card>
              <Label color={mc.redSoft}>WHAT IS HAPPENING</Label>
              <Text style={styles.guideText}>
                Occipital neuralgia is pain from an irritated or compressed occipital
                nerve running from the top of the neck to the scalp. It causes sudden,
                sharp, electric-shock pain, often for just seconds to minutes.
              </Text>
            </Card>
          </Rise>
          <Rise index={4}>
            <Card>
              <Label color={mv.warning}>COMMON CAUSES</Label>
              <Bullets items={CAUSES} color={mc.text} />
            </Card>
          </Rise>
          <Rise index={5}>
            <Card tone="mint">
              <Label color={mv.good}>FOODS THAT MAY HELP</Label>
              <Bullets items={FOODS_HELP} color={mc.mintText} />
              <Label color={mv.warning} style={styles.guideSubLabel}>LIMIT / AVOID</Label>
              <Bullets items={FOODS_LIMIT} color={mc.mintText} />
            </Card>
          </Rise>
          <Rise index={6}>
            <Card tone="red">
              <Label color={mv.attentionSoft}>GET MEDICAL HELP IF</Label>
              <Bullets items={RED_FLAGS} color={mc.text} />
            </Card>
          </Rise>
          <Rise index={7}>
            <Card tone="amber">
              <Label color={mv.warning}>IMPORTANT</Label>
              <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
            </Card>
          </Rise>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appBarTitle: {
    ...mtx.titleSm,
    flex: 1,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: mr.circle,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSpacer: { width: 34 },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ringText: {
    fontSize: 15,
    fontWeight: '600',
    color: mv.good,
  },
  todayText: { flex: 1, gap: 3 },
  todayBig: { ...mtx.rowTitle },
  todaySub: {
    fontSize: 11,
    color: mc.mintText,
    lineHeight: 15,
  },
  painBlock: { marginTop: 14, gap: 8 },
  painLabel: { ...mtx.label, color: mv.good },
  painChips: { flexDirection: 'row', gap: 7, paddingRight: 6 },
  painChip: {
    width: 38,
    height: 34,
    borderRadius: mr.chip,
    backgroundColor: alpha(mc.mint, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  painChipOn: { backgroundColor: mv.good },
  painChipText: { fontSize: 14, color: mc.text },
  painChipTextOn: { color: mc.ink, fontWeight: '700' },
  clearPain: {
    height: 34,
    borderRadius: mr.chip,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: mc.raised,
  },
  clearPainText: { fontSize: 12, color: mc.textDim },
  introText: { ...mtx.body, marginTop: 8, lineHeight: 19, color: mc.text },
  exerciseHead: { flexDirection: 'row', gap: 12 },
  exerciseHeadText: { flex: 1, gap: 4 },
  exerciseSub: { ...mtx.rowSub, lineHeight: 16 },
  dosePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 3,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: mr.chip,
    backgroundColor: mc.amberDim,
  },
  doseText: { fontSize: 11, color: mc.amber },
  steps: { marginTop: 12, gap: 8 },
  stepRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  stepNumber: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: mc.raised,
    color: mc.textDim,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 18,
    overflow: 'hidden',
  },
  stepText: { flex: 1, fontSize: 12.5, color: mc.text, lineHeight: 18 },
  cautionBox: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
    marginTop: 12,
    padding: 10,
    borderRadius: mr.row,
    backgroundColor: mc.amberDim,
  },
  cautionText: { flex: 1, fontSize: 11.5, color: mc.amber, lineHeight: 16 },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: mr.chip,
    backgroundColor: mc.raised,
  },
  smallBtnText: { fontSize: 11.5, color: mc.textDim },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: mr.chip,
    backgroundColor: mc.raised,
  },
  doneBtnOn: { backgroundColor: mv.good },
  doneBtnText: { fontSize: 12.5, color: mc.text, fontWeight: '600' },
  doneBtnTextOn: { color: mc.ink },
  habitGroup: { marginTop: 16 },
  groupTitle: { ...mtx.label, color: mc.textFaint, marginBottom: 6 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: mc.line,
  },
  checkBox: {
    width: 21,
    height: 21,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: mc.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxDone: { backgroundColor: mv.good, borderColor: mv.good },
  checkEmoji: { fontSize: 16 },
  checkLabel: { flex: 1, fontSize: 13.5, color: mc.text },
  checkLabelDone: { color: mc.textDim, textDecorationLine: 'line-through' },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: mr.chip,
    backgroundColor: mc.amberDim,
  },
  streakText: { fontSize: 11, color: mc.amber, fontWeight: '600' },
  guideText: { ...mtx.body, marginTop: 8, lineHeight: 20 },
  guideSubLabel: { marginTop: 16 },
  bullets: { marginTop: 8, gap: 9 },
  bulletRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 7,
    opacity: 0.85,
  },
  bulletText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  disclaimer: { marginTop: 8, fontSize: 12, lineHeight: 18, color: mc.amber },
});
