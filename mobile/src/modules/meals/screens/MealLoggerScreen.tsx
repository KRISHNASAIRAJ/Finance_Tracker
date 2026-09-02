/**
 * MealLoggerScreen — Daily meal logging with macro tracking, calendar picker, and AI suggestions.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useMealStore, MealLogEntry } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { getTodayDateString, addDays, isToday, formatDate, formatDateFull } from '../../../shared/istDate';
import { supabase } from '../../../services/supabaseClient';
import { scheduleMealReminders, checkMealReminderNotifications, requestNotificationPermissions } from '../../../services/dietNotifications';
import { useFinanceStore } from '../../finance/store';
import { tc, ts, tr, card, sectionTitle, dataLarge, dataBase, labelMuted, progressTrack, macroDot } from '../../../shared/theme/tracend';
import CalendarPicker from '../../../shared/components/CalendarPicker';
import DraggableFab from '../../../shared/components/DraggableFab';

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

const MEAL_META: Record<MealType, { label: string; icon: string; color: string; bg: string }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny-outline', color: tc.action, bg: tc.actionDim },
  lunch: { label: 'Lunch', icon: 'restaurant-outline', color: tc.amber, bg: 'rgba(226,164,92,0.12)' },
  snack: { label: 'Snack', icon: 'nutrition-outline', color: tc.carbs, bg: tc.carbsBg },
  dinner: { label: 'Dinner', icon: 'moon-outline', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
};

export default function MealLoggerScreen() {
  const navigation = useNavigation();
  const entries = useMealStore((s) => s.entries) || [];
  const dailyCalorieTarget = useMealStore((s) => s.dailyCalorieTarget) || 0;
  const dailyProteinTarget = useMealStore((s) => s.dailyProteinTarget) || 0;
  const dailyCarbsTarget = useMealStore((s) => s.dailyCarbsTarget) || 0;
  const dailyFatTarget = useMealStore((s) => s.dailyFatTarget) || 0;
  const dailyWaterTarget = useMealStore((s) => s.dailyWaterTarget) || 0;
  const setTargets = useMealStore((s) => s.setTargets);
  const addNotification = useFinanceStore((s) => s.addNotification);
  const { user } = useAuth();

  useFocusEffect(
    useCallback(() => {
      requestNotificationPermissions();
      scheduleMealReminders();
      const todayEntries = entries.filter((e) => e.date.slice(0, 10) === getTodayDateString());
      const loggedTypes = new Set(todayEntries.map((e) => e.mealType));
      checkMealReminderNotifications(addNotification, loggedTypes);
    }, [entries, addNotification])
  );

  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [showLogOptions, setShowLogOptions] = useState(false);
  const [logMealType, setLogMealType] = useState<MealType>(() => {
    const h = new Date().getHours();
    if (h < 11) return 'breakfast';
    if (h < 17) return 'lunch';
    if (h < 20) return 'snack';
    return 'dinner';
  });
  const [showTargets, setShowTargets] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [dailyReport, setDailyReport] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [targetCal, setTargetCal] = useState(dailyCalorieTarget.toString());
  const [targetProt, setTargetProt] = useState(dailyProteinTarget.toString());
  const [targetCarbs, setTargetCarbs] = useState(dailyCarbsTarget.toString());
  const [targetFat, setTargetFat] = useState(dailyFatTarget.toString());
  const [targetWater, setTargetWater] = useState(dailyWaterTarget.toString());

  const dateIsToday = isToday(selectedDate);

  const selectedDateEntries = useMemo(
    () => (Array.isArray(entries) ? entries.filter((e) => e.date.slice(0, 10) === selectedDate) : []),
    [entries, selectedDate]
  );

  const selectedDateTotals = useMemo(
    () => selectedDateEntries.reduce((acc, e) => {
      for (const item of e.items) {
        acc.calories += item.calories || 0;
        acc.protein += item.protein || 0;
        acc.carbs += item.carbs || 0;
        acc.fat += item.fat || 0;
      }
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 }),
    [selectedDateEntries]
  );

  const calPercent = dailyCalorieTarget > 0 ? Math.min(100, (selectedDateTotals.calories / dailyCalorieTarget) * 100) : 0;
  const protPercent = dailyProteinTarget > 0 ? Math.min(100, (selectedDateTotals.protein / dailyProteinTarget) * 100) : 0;
  const carbsPercent = dailyCarbsTarget > 0 ? Math.min(100, (selectedDateTotals.carbs / dailyCarbsTarget) * 100) : 0;
  const fatPercent = dailyFatTarget > 0 ? Math.min(100, (selectedDateTotals.fat / dailyFatTarget) * 100) : 0;

  const remainingCal = Math.max(0, dailyCalorieTarget - selectedDateTotals.calories);
  const remainingProt = Math.max(0, dailyProteinTarget - selectedDateTotals.protein);

  const goToPrevDay = () => setSelectedDate(addDays(selectedDate, -1));
  const goToNextDay = () => {
    const next = addDays(selectedDate, 1);
    if (next <= getTodayDateString()) setSelectedDate(next);
  };

  const handleSaveTargets = () => {
    const cal = parseInt(targetCal, 10) || 0;
    const prot = parseInt(targetProt, 10) || 0;
    const carbs = parseInt(targetCarbs, 10) || 0;
    const fat = parseInt(targetFat, 10) || 0;
    const water = parseFloat(targetWater) || 0;
    setTargets(cal, prot, carbs, fat, water);
    setShowTargets(false);
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera permission is required.'); return false; }
    return true;
  };

  const handleTakePhoto = async () => {
    setShowLogOptions(false);
    if (!(await requestCameraPermission())) return;
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.4, base64: true });
      if (!result.canceled && result.assets[0]?.base64) {
        (navigation as any).navigate('MealAIConfirm', { imageBase64: result.assets[0].base64, mealType: logMealType, date: selectedDate });
      }
    } catch (e: any) { Alert.alert('Camera Error', e?.message || 'Could not capture photo'); }
  };

  const handlePickGallery = async () => {
    setShowLogOptions(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Gallery permission is required.'); return; }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.4, base64: true });
      if (!result.canceled && result.assets[0]?.base64) {
        (navigation as any).navigate('MealAIConfirm', { imageBase64: result.assets[0].base64, mealType: logMealType, date: selectedDate });
      }
    } catch (e: any) { Alert.alert('Gallery Error', e?.message || 'Could not select photo'); }
  };

  const handleDescribeMeal = () => {
    setShowLogOptions(false);
    (navigation as any).navigate('MealAIConfirm', { mealType: logMealType, date: selectedDate });
  };

  const handleManualEntry = () => {
    setShowLogOptions(false);
    (navigation as any).navigate('MealEdit', { date: selectedDate, mealType: logMealType });
  };

  const openEdit = (entry: MealLogEntry) => {
    (navigation as any).navigate('MealEdit', { entryId: entry.id, date: selectedDate });
  };

  const hasDinnerToday = dateIsToday && selectedDateEntries.some((e) => e.mealType === 'dinner');

  const weekOverview = useMemo(() => {
    const days: { date: string; label: string; calories: number; protein: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(getTodayDateString(), -i);
      const dayEntries = entries.filter((e) => e.date.slice(0, 10) === d);
      const totals = dayEntries.reduce((acc, e) => {
        for (const item of e.items) {
          acc.calories += item.calories || 0;
          acc.protein += item.protein || 0;
        }
        return acc;
      }, { calories: 0, protein: 0 });
      const dObj = new Date(d + 'T00:00:00+05:30');
      const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      days.push({
        date: d,
        label: d === getTodayDateString() ? 'Today' : labels[dObj.getDay()],
        calories: totals.calories,
        protein: totals.protein,
      });
    }
    return days;
  }, [entries]);

  const [graphMode, setGraphMode] = useState<'week' | 'month'>('week');

  const monthOverview = useMemo(() => {
    const today = new Date(`${getTodayDateString()}T00:00:00+05:30`);
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const days: { date: string; label: string; calories: number; protein: number }[] = [];
    for (let d = new Date(firstDay); d <= today; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      const dayEntries = entries.filter((e) => e.date.slice(0, 10) === ds);
      const totals = dayEntries.reduce((acc, e) => {
        for (const item of e.items) {
          acc.calories += item.calories || 0;
          acc.protein += item.protein || 0;
        }
        return acc;
      }, { calories: 0, protein: 0 });
      days.push({
        date: ds,
        label: String(d.getDate()),
        calories: totals.calories,
        protein: totals.protein,
      });
    }
    return days;
  }, [entries]);

  const activeGraphData = graphMode === 'week' ? weekOverview : monthOverview;
  const maxGraphCal = Math.max(dailyCalorieTarget, ...activeGraphData.map((d) => d.calories), 1);
  const maxGraphProt = Math.max(dailyProteinTarget, ...activeGraphData.map((d) => d.protein), 1);

  const generateDailyReport = async () => {
    setReportGenerating(true);
    try {
      const todayEntries = selectedDateEntries;
      let intake = '';
      for (const entry of todayEntries) {
        intake += `\n${entry.mealType.toUpperCase()}:\n`;
        for (const item of entry.items) {
          intake += `- ${item.name}${item.quantity ? ` (${item.quantity})` : ''}: ${item.calories}cal, ${item.protein}g P, ${item.carbs}g C, ${item.fat}g F\n`;
        }
      }
      if (!intake) intake = 'No meals logged today.';

      const { data, error } = await supabase.functions.invoke('ai-daily-report', { body: { todayIntake: intake } });
      if (data?.report) {
        setDailyReport(data.report);
        setShowReport(true);
      } else {
        setDailyReport(error?.message || 'Could not generate report.');
        setShowReport(true);
      }
    } catch (e: any) {
      setDailyReport(e?.message || 'Failed to generate report.');
      setShowReport(true);
    } finally {
      setReportGenerating(false);
    }
  };

  const formatNum = (n: number) => n.toFixed(0);

  return (
    <SafeAreaView style={styles.container}>
      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={tc.action} />
        </TouchableOpacity>
        <View style={styles.appBarCenter}>
          <Text style={styles.appBarTitle}>Nutrition</Text>
        </View>
        <TouchableOpacity style={styles.iconBtnSmall} onPress={() => { setTargetCal(dailyCalorieTarget.toString()); setTargetProt(dailyProteinTarget.toString()); setTargetCarbs(dailyCarbsTarget.toString()); setTargetFat(dailyFatTarget.toString()); setTargetWater(dailyWaterTarget.toString()); setShowTargets(true); }}>
          <Ionicons name="options-outline" size={20} color={tc.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Date Swapper */}
      <View style={styles.dateBar}>
        <TouchableOpacity onPress={goToPrevDay} style={styles.dateArrow}>
          <Ionicons name="chevron-back" size={20} color={tc.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Text style={[styles.dateText, dateIsToday && { color: tc.action }]}>
            {dateIsToday ? 'Today' : formatDateFull(selectedDate)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNextDay} style={[styles.dateArrow, dateIsToday && { opacity: 0.3 }]} disabled={dateIsToday}>
          <Ionicons name="chevron-forward" size={20} color={tc.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Daily Targets — Tracend grid */}
        <View style={styles.targetsCard}>
          <View style={styles.targetsHeader}>
            <Text style={labelMuted}>Today's Targets</Text>
            <Text style={styles.targetsUpdated}>Live</Text>
          </View>

          {/* Energy Intake — full width */}
          <View style={styles.targetBlockFull}>
            <View style={styles.targetBlockHeader}>
              <Text style={styles.targetBlockLabel}>ENERGY INTAKE</Text>
              <Text style={styles.targetBlockPct}>{calPercent.toFixed(0)}%</Text>
            </View>
            <View style={styles.targetBlockValues}>
              <Text style={[dataLarge, { fontSize: 26 }]}>{formatNum(selectedDateTotals.calories)}</Text>
              <Text style={styles.targetBlockUnit}>/ {dailyCalorieTarget} kcal</Text>
            </View>
            <View style={progressTrack}>
              <View style={[styles.progressFillWhite, { width: `${calPercent}%` }]} />
            </View>
          </View>

          {/* Protein Priority — full width, indigo tint */}
          <View style={[styles.targetBlockFull, styles.targetBlockAccent]}>
            <View style={styles.targetBlockHeader}>
              <View style={styles.targetLabelRow}>
                <View style={macroDot(tc.action)} />
                <Text style={[styles.targetBlockLabel, { color: tc.action }]}>PROTEIN PRIORITY</Text>
              </View>
              <Text style={[styles.targetBlockPct, { color: tc.action }]}>{protPercent.toFixed(0)}%</Text>
            </View>
            <View style={styles.targetBlockValues}>
              <Text style={[dataLarge, { fontSize: 26, color: tc.action }]}>{formatNum(selectedDateTotals.protein)}</Text>
              <Text style={[styles.targetBlockUnit, { color: 'rgba(155,165,255,0.5)' }]}>/ {dailyProteinTarget}g</Text>
              <Text style={styles.proteinRemaining}>· {remainingProt}g left</Text>
            </View>
            <View style={progressTrack}>
              <View style={[styles.progressFillAction, { width: `${protPercent}%` }]} />
            </View>
          </View>

          {/* Carbs + Fats — side by side */}
          <View style={styles.targetsRow}>
            <View style={[styles.targetBlockHalf, { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: tc.border }]}>
              <Text style={[styles.targetBlockLabel, { color: tc.carbs }]}>CARBS</Text>
              <View style={styles.targetValuesRow}>
                <Text style={styles.targetSmallVal}>{formatNum(selectedDateTotals.carbs)}</Text>
                <Text style={styles.targetSmallUnit}>g</Text>
              </View>
              <View style={progressTrack}>
                <View style={[styles.progressFillCarb, { width: `${carbsPercent}%` }]} />
              </View>
            </View>
            <View style={styles.targetBlockHalf}>
              <Text style={[styles.targetBlockLabel, { color: tc.fat }]}>FATS</Text>
              <View style={styles.targetValuesRow}>
                <Text style={styles.targetSmallVal}>{formatNum(selectedDateTotals.fat)}</Text>
                <Text style={styles.targetSmallUnit}>g</Text>
              </View>
              <View style={progressTrack}>
                <View style={[styles.progressFillFat, { width: `${fatPercent}%` }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Remaining & Recommendation */}
        {dailyCalorieTarget > 0 && (
          <View style={styles.remainingCard}>
            <View style={styles.remainingRow}>
              <View style={styles.remainingItem}>
                <Text style={styles.remainingVal}>{remainingCal}</Text>
                <Text style={styles.remainingLabel}>kcal remaining</Text>
              </View>
              <View style={styles.remainingDivider} />
              <View style={[styles.remainingItem, { alignItems: 'flex-end' }]}>
                <Text style={[styles.remainingVal, { color: tc.action }]}>{remainingProt}</Text>
                <Text style={styles.remainingLabel}>g protein left</Text>
              </View>
            </View>
            {selectedDateEntries.length > 0 && remainingCal > 0 && (
              <Text style={styles.remainingHint}>
                <Text style={{ color: tc.action, fontWeight: '600' }}>Build around:</Text> lean protein for your next meal.
              </Text>
            )}
          </View>
        )}

        {/* LOG MEAL */}
        <TouchableOpacity style={styles.logMealBtn} onPress={() => setShowLogOptions(true)} activeOpacity={0.9}>
          <Ionicons name="add-circle" size={22} color={tc.canvas} />
          <Text style={styles.logMealBtnText}>LOG MEAL</Text>
        </TouchableOpacity>

        {/* Nutrition Graph */}
        <View style={styles.graphCard}>
          <View style={styles.graphHeader}>
            <Text style={labelMuted}>Nutrition Trend</Text>
            <View style={styles.graphToggle}>
              <TouchableOpacity
                style={[styles.toggleChip, graphMode === 'week' && styles.toggleChipActive]}
                onPress={() => setGraphMode('week')}
              >
                <Text style={[styles.toggleChipText, graphMode === 'week' && styles.toggleChipTextActive]}>7D</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleChip, graphMode === 'month' && styles.toggleChipActive]}
                onPress={() => setGraphMode('month')}
              >
                <Text style={[styles.toggleChipText, graphMode === 'month' && styles.toggleChipTextActive]}>30D</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.graphLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.legendText}>Calories</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: tc.action }]} />
              <Text style={styles.legendText}>Protein</Text>
            </View>
          </View>
          {(() => {
            const data = activeGraphData;
            const W = data.length > 1 ? (data.length - 1) * 40 + 20 : 320;
            const H = 120;
            const padX = 16;
            const padT = 14;
            const padB = 20;
            const chartH = H - padT - padB;
            const maxV = maxGraphCal || 1;

            const calPoints = data.map((d, i) => {
              const x = padX + i * 40;
              const y = padT + chartH - (d.calories / maxV) * chartH;
              return { x, y, label: d.label, date: d.date };
            });

            let calPath = '';
            let calFill = '';
            if (calPoints.length > 1) {
              calPath = `M ${calPoints[0].x} ${calPoints[0].y}`;
              for (let i = 0; i < calPoints.length - 1; i++) {
                const cpX = calPoints[i].x + (calPoints[i + 1].x - calPoints[i].x) / 2;
                calPath += ` C ${cpX} ${calPoints[i].y}, ${cpX} ${calPoints[i + 1].y}, ${calPoints[i + 1].x} ${calPoints[i + 1].y}`;
              }
              calFill = `${calPath} L ${calPoints[calPoints.length - 1].x} ${padT + chartH} L ${calPoints[0].x} ${padT + chartH} Z`;
            }

            const protPoints = data.map((d, i) => {
              const x = padX + i * 40;
              const y = padT + chartH - (d.protein / maxGraphProt) * chartH;
              return { x, y };
            });

            const protTargetY = padT + chartH - (dailyProteinTarget / maxGraphProt) * chartH;

            let protPath = '';
            if (protPoints.length > 1) {
              protPath = `M ${protPoints[0].x} ${protPoints[0].y}`;
              for (let i = 0; i < protPoints.length - 1; i++) {
                const cpX = protPoints[i].x + (protPoints[i + 1].x - protPoints[i].x) / 2;
                protPath += ` C ${cpX} ${protPoints[i].y}, ${cpX} ${protPoints[i + 1].y}, ${protPoints[i + 1].x} ${protPoints[i + 1].y}`;
              }
            }

            return (
              <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
                <Defs>
                  <LinearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                    <Stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                  </LinearGradient>
                </Defs>
                {calFill ? <Path d={calFill} fill="url(#calGrad)" /> : null}
                {calPath ? <Path d={calPath} stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
                {dailyProteinTarget > 0 && (
                  <Path
                    d={`M ${padX} ${protTargetY} L ${padX + (data.length - 1) * 40} ${protTargetY}`}
                    stroke={tc.action}
                    strokeWidth="1"
                    strokeOpacity="0.35"
                    fill="none"
                    strokeDasharray="2,4"
                  />
                )}
                {protPath ? <Path d={protPath} stroke={tc.action} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
                {protPoints.map((p, i) => (
                  <Circle
                    key={`p-${data[i].date}`}
                    cx={p.x}
                    cy={p.y}
                    r="3"
                    fill={tc.action}
                    stroke={tc.canvas}
                    strokeWidth="1.5"
                  />
                ))}
                {data.map((d, i) => (
                  <SvgText
                    key={d.date}
                    x={padX + i * 40}
                    y={H - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight={d.date === getTodayDateString() ? '700' : '400'}
                    fill={d.date === getTodayDateString() ? tc.action : tc.textMuted}
                  >
                    {d.label}
                  </SvgText>
                ))}
              </Svg>
            );
          })()}
        </View>

        {/* Meals Timeline */}
        <Text style={[labelMuted, { marginTop: 12 }]}>Timeline</Text>
        {selectedDateEntries.length === 0 ? (
          <Text style={styles.emptyText}>
            {dateIsToday ? 'No meals logged today. Tap "LOG MEAL" to begin.' : 'No meals logged for this date.'}
          </Text>
        ) : (
          selectedDateEntries.map((entry) => {
            const meta = MEAL_META[entry.mealType];
            const mealCal = entry.items.reduce((s, i) => s + i.calories, 0);
            const mealProt = entry.items.reduce((s, i) => s + i.protein, 0);
            const mealCarbs = entry.items.reduce((s, i) => s + i.carbs, 0);
            const mealFat = entry.items.reduce((s, i) => s + i.fat, 0);
            const itemNames = entry.items.map((i) => i.name);
            const mealLabel = itemNames.length >= 2
              ? `${itemNames[0]} + ${itemNames.length - 1} more`
              : itemNames.length === 1
                ? itemNames[0]
                : meta.label;
            return (
              <TouchableOpacity key={entry.id} style={card} onPress={() => openEdit(entry)} activeOpacity={0.7}>
                <View style={styles.mealRow}>
                  <View style={styles.mealLeft}>
                    <View style={styles.mealTypePill}>
                      <View style={[styles.mealDot, { borderColor: meta.color }]} />
                      <Text style={styles.mealTypeText}>{meta.label}</Text>
                    </View>
                    <Text style={styles.mealName} numberOfLines={1}>{mealLabel}</Text>
                    {itemNames.length > 2 && (
                      <View style={styles.mealItemsRow}>
                        {entry.items.slice(0, 3).map((item, i) => (
                          <Text key={i} style={styles.mealItemPill} numberOfLines={1}>{item.name}</Text>
                        ))}
                        {entry.items.length > 3 && <Text style={styles.mealItemPill}>+{entry.items.length - 3}</Text>}
                      </View>
                    )}
                  </View>
                  <View style={styles.mealRight}>
                    <View style={styles.mealMacroDots}>
                      {mealProt > 0 && <View style={macroDot(tc.action)} />}
                      {mealCarbs > 0 && <View style={macroDot(tc.carbs)} />}
                      {mealFat > 0 && <View style={macroDot(tc.fat)} />}
                    </View>
                    <Text style={styles.mealKcal}>{mealCal} kcal</Text>
                    <Text style={styles.mealProtein}>{mealProt}g P</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* EOD Daily Report */}
        {hasDinnerToday && (
          <View style={styles.reportSection}>
            {reportGenerating ? (
              <View style={styles.reportLoading}>
                <ActivityIndicator size="small" color={tc.action} />
                <Text style={styles.reportLoadingText}>Generating daily report...</Text>
              </View>
            ) : !showReport ? (
              <TouchableOpacity style={styles.reportBtn} onPress={generateDailyReport} activeOpacity={0.9}>
                <Ionicons name="sparkles" size={16} color={tc.canvas} />
                <Text style={styles.reportBtnText}>Generate Daily Report</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.reportCard}>
                <View style={styles.reportCardHeader}>
                  <Ionicons name="sparkles" size={14} color={tc.action} />
                  <Text style={styles.reportCardTitle}>Daily Report</Text>
                  <TouchableOpacity onPress={() => setShowReport(false)}>
                    <Ionicons name="close-circle" size={18} color={tc.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.reportText}>{dailyReport}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Log Options — Bottom Sheet */}
      <Modal visible={showLogOptions} transparent animationType="slide" onRequestClose={() => setShowLogOptions(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>Log Meal</Text>
              <TouchableOpacity onPress={() => setShowLogOptions(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={tc.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetSectionLabel}>MEAL TYPE</Text>
            <View style={styles.mealTypeLogRow}>
              {(Object.keys(MEAL_META) as MealType[]).map((type) => {
                const m = MEAL_META[type];
                const selected = logMealType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.mealTypeLogChip, selected && { backgroundColor: m.bg, borderColor: m.color }]}
                    onPress={() => setLogMealType(type)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={m.icon as any} size={13} color={selected ? m.color : tc.textMuted} />
                    <Text style={[styles.mealTypeLogText, selected && { color: m.color }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sheetSectionLabel, { marginTop: 4 }]}>HOW WOULD YOU LIKE TO LOG IT?</Text>
            <View style={styles.sheetGrid}>
              <TouchableOpacity style={styles.sheetTile} onPress={handleTakePhoto} activeOpacity={0.7}>
                <View style={[styles.sheetTileIcon, { backgroundColor: tc.actionDim }]}>
                  <Ionicons name="camera-outline" size={22} color={tc.action} />
                </View>
                <Text style={styles.sheetTileTitle}>Take Photo</Text>
                <Text style={styles.sheetTileSub}>AI analyzes your meal</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetTile} onPress={handlePickGallery} activeOpacity={0.7}>
                <View style={[styles.sheetTileIcon, { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
                  <Ionicons name="images-outline" size={22} color="#60a5fa" />
                </View>
                <Text style={styles.sheetTileTitle}>From Gallery</Text>
                <Text style={styles.sheetTileSub}>Pick an existing photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetTile} onPress={handleDescribeMeal} activeOpacity={0.7}>
                <View style={[styles.sheetTileIcon, { backgroundColor: 'rgba(226,164,92,0.12)' }]}>
                  <Ionicons name="text-outline" size={22} color={tc.amber} />
                </View>
                <Text style={styles.sheetTileTitle}>Describe Meal</Text>
                <Text style={styles.sheetTileSub}>AI estimates macros</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetTile} onPress={handleManualEntry} activeOpacity={0.7}>
                <View style={[styles.sheetTileIcon, { backgroundColor: 'rgba(244,247,251,0.06)' }]}>
                  <Ionicons name="create-outline" size={22} color={tc.textSecondary} />
                </View>
                <Text style={styles.sheetTileTitle}>Enter Manually</Text>
                <Text style={styles.sheetTileSub}>Add items by hand</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.sheetCancel} onPress={() => setShowLogOptions(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <CalendarPicker
        visible={showDatePicker}
        selected={new Date(selectedDate + 'T12:00:00')}
        onSelect={(d) => {
          setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Targets Modal */}
      <Modal visible={showTargets} transparent animationType="fade" onRequestClose={() => setShowTargets(false)}>
        <View style={styles.modalCenter}>
          <View style={styles.targetModalCard}>
            <Text style={styles.modalTitle}>Daily Targets</Text>
            {([
              ['Calorie Target', targetCal, setTargetCal, 'number-pad'],
              ['Protein (g)', targetProt, setTargetProt, 'number-pad'],
              ['Carbs (g)', targetCarbs, setTargetCarbs, 'number-pad'],
              ['Fat (g)', targetFat, setTargetFat, 'number-pad'],
              ['Water (L)', targetWater, setTargetWater, 'decimal-pad'],
            ] as const).map(([label, value, setter, keyboard]) => (
              <View style={styles.targetField} key={label}>
                <Text style={styles.targetFieldLabel}>{label}</Text>
                <TextInput
                  style={styles.targetFieldInput}
                  value={value}
                  onChangeText={setter}
                  keyboardType={keyboard as any}
                  placeholderTextColor={tc.textMuted}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTargets}>
              <Text style={styles.saveBtnText}>Save Targets</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setShowTargets(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Floating AI Button — draggable */}
      <DraggableFab
        icon="sparkles"
        color={tc.canvas}
        storageKey="meridian-fab-meals"
        onPress={() => (navigation as any).navigate('MealAISuggestions')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tc.canvas,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: ts.gutter,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tc.border,
  },
  appBarCenter: { alignItems: 'center' },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tc.textPrimary,
    letterSpacing: -0.3,
  },
  iconBtn: { padding: 8, borderRadius: tr.full },
  iconBtnSmall: { padding: 6, borderRadius: tr.full },

  // Date bar
  dateBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ts.gutter,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tc.border,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    color: tc.textSecondary,
  },
  dateArrow: { padding: 6 },

  scroll: { padding: ts.gutter, gap: 14, paddingBottom: 50 },

  // ── Daily Targets ──
  targetsCard: {
    ...card,
    padding: 16,
    gap: 12,
  },
  targetsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetsUpdated: {
    fontSize: 10,
    color: tc.textMuted,
    fontWeight: '500',
  },
  targetsRow: {
    flexDirection: 'row',
  },
  targetBlockFull: {
    padding: 12,
    gap: 8,
    borderRadius: tr.DEFAULT,
  },
  targetBlockAccent: {
    backgroundColor: tc.actionDim,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  targetBlockHalf: {
    flex: 1,
    gap: 6,
    padding: 14,
  },
  targetBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  targetBlockLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: tc.textMuted,
    letterSpacing: 0.8,
  },
  targetBlockPct: {
    fontSize: 13,
    fontWeight: '700',
    color: tc.textPrimary,
  },
  targetBlockValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  targetBlockUnit: {
    fontSize: 11,
    color: tc.textMuted,
    fontWeight: '500',
  },
  targetBlockSmall: {
    flex: 1,
    gap: 6,
    padding: 14,
  },
  targetValuesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  targetSmallVal: {
    fontSize: 20,
    fontWeight: '700',
    color: tc.textPrimary,
  },
  targetSmallUnit: {
    fontSize: 10,
    color: tc.textMuted,
    fontWeight: '500',
  },
  progressFillWhite: {
    height: 1.5,
    backgroundColor: tc.textPrimary,
    borderRadius: 1,
    opacity: 0.7,
  },
  progressFillAction: {
    height: 1.5,
    backgroundColor: tc.action,
    borderRadius: 1,
  },
  progressFillCarb: {
    height: 1.5,
    backgroundColor: tc.carbs,
    borderRadius: 1,
  },
  progressFillFat: {
    height: 1.5,
    backgroundColor: tc.fat,
    borderRadius: 1,
  },
  proteinRemaining: {
    fontSize: 10,
    fontWeight: '600',
    color: tc.action,
    marginLeft: 12,
  },

  // ── Remaining ──
  remainingCard: {
    ...card,
    padding: 14,
    gap: 10,
  },
  remainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  remainingItem: {
    flex: 1,
    gap: 2,
  },
  remainingVal: {
    fontSize: 18,
    fontWeight: '700',
    color: tc.textPrimary,
  },
  remainingLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: tc.textMuted,
    letterSpacing: 0.4,
  },
  remainingDivider: {
    width: 1,
    height: 32,
    backgroundColor: tc.border,
    marginHorizontal: 16,
  },
  remainingHint: {
    fontSize: 12,
    color: tc.textSecondary,
    lineHeight: 17,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tc.border,
  },

  // ── Log Meal ──
  logMealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tc.action,
    paddingVertical: 15,
    borderRadius: tr.lg,
    shadowColor: tc.action,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  logMealBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: tc.canvas,
    letterSpacing: 1,
  },

  // ── Graph ──
  graphCard: {
    ...card,
    padding: 16,
    gap: 10,
  },
  graphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  graphToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(244,247,251,0.06)',
    borderRadius: tr.full,
    padding: 2,
    gap: 2,
  },
  toggleChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: tr.full,
  },
  toggleChipActive: {
    backgroundColor: tc.actionDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.borderFocus,
  },
  toggleChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: tc.textMuted,
  },
  toggleChipTextActive: {
    color: tc.action,
  },
  graphLegend: {
    flexDirection: 'row',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 1.5,
  },
  legendText: {
    fontSize: 10,
    color: tc.textMuted,
    fontWeight: '500',
  },

  // ── Meal Timeline ──
  emptyText: {
    fontSize: 13,
    color: tc.textMuted,
    textAlign: 'center',
    paddingVertical: 24,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  mealLeft: {
    flex: 1,
    gap: 6,
  },
  mealTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mealDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
  },
  mealTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: tc.textMuted,
    letterSpacing: 0.5,
  },
  mealName: {
    fontSize: 14,
    fontWeight: '600',
    color: tc.textPrimary,
  },
  mealItemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  mealItemPill: {
    fontSize: 10,
    color: tc.textMuted,
    backgroundColor: 'rgba(244,247,251,0.04)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  mealRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  mealMacroDots: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 2,
  },
  mealKcal: {
    fontSize: 14,
    fontWeight: '700',
    color: tc.textPrimary,
  },
  mealProtein: {
    fontSize: 11,
    color: tc.action,
    fontWeight: '600',
  },

  // ── Sheet ──
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tc.surfaceRaised,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tc.border,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(198,197,215,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tc.textPrimary,
  },
  sheetSectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: tc.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  mealTypeLogRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  mealTypeLogChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: tr.DEFAULT,
    backgroundColor: tc.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  mealTypeLogText: { fontSize: 10, fontWeight: '600', color: tc.textMuted },
  sheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetTile: {
    width: '48.5%',
    backgroundColor: tc.surface,
    borderRadius: tr.lg,
    padding: 14,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  sheetTileIcon: {
    width: 40,
    height: 40,
    borderRadius: tr.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sheetTileTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tc.textPrimary,
  },
  sheetTileSub: {
    fontSize: 10,
    color: tc.textSecondary,
    lineHeight: 13,
  },
  sheetCancel: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  sheetCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: tc.textSecondary,
  },

  // ── Modals ──
  modalCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tc.textPrimary,
    textAlign: 'center',
    marginBottom: 18,
  },
  // ── Targets Modal ──
  targetModalCard: {
    backgroundColor: tc.surface,
    borderRadius: tr.lg,
    padding: 24,
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  targetField: { gap: 5, marginBottom: 12 },
  targetFieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: tc.textMuted,
    letterSpacing: 0.5,
  },
  targetFieldInput: {
    backgroundColor: 'rgba(244,247,251,0.04)',
    borderRadius: tr.DEFAULT,
    height: 44,
    paddingHorizontal: 14,
    color: tc.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
  },
  saveBtn: {
    backgroundColor: tc.action,
    paddingVertical: 14,
    borderRadius: tr.DEFAULT,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: tc.canvas,
  },

  // ── Report ──
  reportSection: { marginTop: 4 },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tc.action,
    paddingVertical: 14,
    borderRadius: tr.DEFAULT,
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tc.canvas,
  },
  reportLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  reportLoadingText: {
    fontSize: 13,
    color: tc.textSecondary,
  },
  reportCard: {
    ...card,
    borderColor: tc.borderFocus,
    padding: 14,
    gap: 10,
  },
  reportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tc.textPrimary,
    flex: 1,
  },
  reportText: {
    fontSize: 12,
    color: tc.textSecondary,
    lineHeight: 18,
  },
});
