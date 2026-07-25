import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useMealStore, MealLogEntry } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import { getTodayDateString, addDays, isToday, formatDate, formatDateFull } from '../../../shared/istDate';
import { supabase } from '../../../services/supabaseClient';
import { scheduleMealReminders, checkMealReminderNotifications, requestNotificationPermissions } from '../../../services/dietNotifications';
import { useFinanceStore } from '../../finance/store';

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

const MEAL_META: Record<MealType, { label: string; icon: string; color: string }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny-outline', color: colors.primary },
  lunch: { label: 'Lunch', icon: 'restaurant-outline', color: '#f59e0b' },
  snack: { label: 'Snack', icon: 'nutrition-outline', color: colors.success },
  dinner: { label: 'Dinner', icon: 'moon-outline', color: '#3b82f6' },
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

  const goToPrevDay = () => setSelectedDate(addDays(selectedDate, -1));
  const goToNextDay = () => {
    const next = addDays(selectedDate, 1);
    if (next <= getTodayDateString()) setSelectedDate(next);
  };
  const goToToday = () => setSelectedDate(getTodayDateString());

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
        (navigation as any).navigate('MealAIConfirm', { imageBase64: result.assets[0].base64, mealType: 'lunch' });
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
        (navigation as any).navigate('MealAIConfirm', { imageBase64: result.assets[0].base64, mealType: 'lunch' });
      }
    } catch (e: any) { Alert.alert('Gallery Error', e?.message || 'Could not select photo'); }
  };

  const handleDescribeMeal = () => {
    setShowLogOptions(false);
    (navigation as any).navigate('MealAIConfirm', { mealType: 'lunch' });
  };

  const handleManualEntry = () => {
    setShowLogOptions(false);
    (navigation as any).navigate('MealEdit', { date: selectedDate });
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
  const maxGraphCal = Math.max(dailyCalorieTarget, ...activeGraphData.map((d) => d.calories));

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
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.appBarCenter}>
          <Text style={styles.appBarTitle}>Meal Logger</Text>
        </View>
        <TouchableOpacity style={styles.iconBtnSm} onPress={() => { setTargetCal(dailyCalorieTarget.toString()); setTargetProt(dailyProteinTarget.toString()); setTargetCarbs(dailyCarbsTarget.toString()); setTargetFat(dailyFatTarget.toString()); setTargetWater(dailyWaterTarget.toString()); setShowTargets(true); }}>
          <Ionicons name="options-outline" size={22} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      {/* Date Swapper */}
      <View style={styles.dateBar}>
        <TouchableOpacity onPress={goToPrevDay} style={styles.dateArrowBig}>
          <Ionicons name="chevron-back" size={20} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Text style={[styles.dateBarText, dateIsToday && { color: colors.primary }]}>
            {dateIsToday ? 'Today' : formatDateFull(selectedDate)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNextDay} style={[styles.dateArrowBig, dateIsToday && { opacity: 0.3 }]} disabled={dateIsToday}>
          <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Daily Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressItem}>
            <View style={styles.progressLabelRow}>
              <Ionicons name="flame-outline" size={16} color="#f59e0b" />
              <Text style={styles.progressLabel}>Calories</Text>
              <Text style={styles.progressValue}>{formatNum(selectedDateTotals.calories)} / {dailyCalorieTarget}</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { backgroundColor: '#f59e0b', width: `${calPercent}%` }]} />
            </View>
          </View>
          <View style={styles.progressItem}>
            <View style={styles.progressLabelRow}>
              <Ionicons name="barbell-outline" size={16} color={colors.success} />
              <Text style={styles.progressLabel}>Protein</Text>
              <Text style={styles.progressValue}>{formatNum(selectedDateTotals.protein)}g / {dailyProteinTarget}g</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { backgroundColor: colors.success, width: `${protPercent}%` }]} />
            </View>
          </View>
          <View style={styles.progressItem}>
            <View style={styles.progressLabelRow}>
              <Ionicons name="pulse-outline" size={16} color="#3b82f6" />
              <Text style={styles.progressLabel}>Carbs</Text>
              <Text style={styles.progressValue}>{formatNum(selectedDateTotals.carbs)}g / {dailyCarbsTarget}g</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { backgroundColor: '#3b82f6', width: `${carbsPercent}%` }]} />
            </View>
          </View>
          <View style={styles.progressItem}>
            <View style={styles.progressLabelRow}>
              <Ionicons name="water-outline" size={16} color="#a78bfa" />
              <Text style={styles.progressLabel}>Fat</Text>
              <Text style={styles.progressValue}>{formatNum(selectedDateTotals.fat)}g / {dailyFatTarget}g</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { backgroundColor: '#a78bfa', width: `${fatPercent}%` }]} />
            </View>
          </View>
          <View style={styles.macroRow}>
            <View style={styles.macroChip}>
              <Text style={styles.macroVal}>{formatNum(selectedDateTotals.carbs)}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.macroChip}>
              <Text style={styles.macroVal}>{formatNum(selectedDateTotals.fat)}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
            <View style={styles.macroChip}>
              <Text style={styles.macroVal}>{selectedDateEntries.reduce((s, e) => s + e.items.length, 0)}</Text>
              <Text style={styles.macroLabel}>Items</Text>
            </View>
            <View style={styles.macroChip}>
              <Text style={styles.macroVal}>{dailyWaterTarget}L</Text>
              <Text style={styles.macroLabel}>Water</Text>
            </View>
          </View>
        </View>

        {/* Nutrition Graph */}
        <View style={styles.weekCard}>
          <View style={styles.weekHeader}>
            <Ionicons name="analytics-outline" size={14} color={colors.onSurfaceVariant} />
            <Text style={styles.weekTitle}>Nutrition Trend</Text>
            <View style={styles.graphToggle}>
              <TouchableOpacity
                style={[styles.toggleChip, graphMode === 'week' && styles.toggleChipActive]}
                onPress={() => setGraphMode('week')}
              >
                <Text style={[styles.toggleChipText, graphMode === 'week' && styles.toggleChipTextActive]}>7 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleChip, graphMode === 'month' && styles.toggleChipActive]}
                onPress={() => setGraphMode('month')}
              >
                <Text style={[styles.toggleChipText, graphMode === 'month' && styles.toggleChipTextActive]}>Month</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.graphLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.legendText}>Calories</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>Protein</Text>
            </View>
          </View>
          {(() => {
            const data = activeGraphData;
            const W = data.length > 1 ? (data.length - 1) * 40 + 20 : 320;
            const H = 130;
            const padX = 16;
            const padT = 16;
            const padB = 22;
            const chartH = H - padT - padB;
            const maxV = maxGraphCal || 1;
            const range = maxV;

            const calPoints = data.map((d, i) => {
              const x = padX + i * 40;
              const y = padT + chartH - (d.calories / range) * chartH;
              return { x, y, label: d.label, date: d.date, calories: d.calories, protein: d.protein };
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
              const y = padT + chartH - (d.protein / maxV) * chartH;
              return { x, y };
            });

            let protPath = '';
            if (protPoints.length > 1) {
              protPath = `M ${protPoints[0].x} ${protPoints[0].y}`;
              for (let i = 0; i < protPoints.length - 1; i++) {
                const cpX = protPoints[i].x + (protPoints[i + 1].x - protPoints[i].x) / 2;
                protPath += ` C ${cpX} ${protPoints[i].y}, ${cpX} ${protPoints[i + 1].y}, ${protPoints[i + 1].x} ${protPoints[i + 1].y}`;
              }
            }

            return (
              <View>
                <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
                  <Defs>
                    <LinearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                      <Stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                    </LinearGradient>
                    <LinearGradient id="protGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
                      <Stop offset="100%" stopColor="#34d399" stopOpacity="0.02" />
                    </LinearGradient>
                  </Defs>
                  {calFill ? <Path d={calFill} fill="url(#calGrad)" /> : null}
                  {calPath ? <Path d={calPath} stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
                  {protPath ? <Path d={protPath} stroke="#34d399" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,4" /> : null}
                  {/* Day labels */}
                  {data.map((d, i) => (
                    <SvgText
                      key={d.date}
                      x={padX + i * 40}
                      y={H - 4}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight={d.date === getTodayDateString() ? '700' : '400'}
                      fill={d.date === getTodayDateString() ? colors.primary : colors.onSurfaceVariant}
                    >
                      {d.label}
                    </SvgText>
                  ))}
                </Svg>
              </View>
            );
          })()}
        </View>

        {/* Log Meal Button */}
        <TouchableOpacity style={styles.addMealBtn} onPress={() => setShowLogOptions(true)} activeOpacity={0.8}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.addMealText}>Log Meal</Text>
        </TouchableOpacity>

        {/* Meals */}
        <Text style={styles.sectionTitle}>{dateIsToday ? "TODAY'S MEALS" : 'MEALS'}</Text>
        {selectedDateEntries.length === 0 ? (
          <Text style={styles.emptyText}>{dateIsToday ? 'No meals logged today' : 'No meals logged for this date'}</Text>
        ) : (
          selectedDateEntries.map((entry) => {
            const meta = MEAL_META[entry.mealType];
            const mealCal = entry.items.reduce((s, i) => s + i.calories, 0);
            const mealProt = entry.items.reduce((s, i) => s + i.protein, 0);
            const itemNames = entry.items.map((i) => i.name);
            const mealLabel = itemNames.length >= 2
              ? `${itemNames[0]}+${itemNames[1]}`
              : itemNames.length === 1
                ? itemNames[0]
                : meta.label;
            const mealIcon = entry.mealType === 'breakfast' ? 'cafe-outline'
              : entry.mealType === 'snack' ? 'ice-cream-outline'
              : 'restaurant-outline';
            return (
              <TouchableOpacity key={entry.id} style={styles.mealCard} onPress={() => openEdit(entry)} activeOpacity={0.7}>
                <View style={[styles.mealIconBox, { backgroundColor: `${meta.color}20` }]}>
                  <Ionicons name={mealIcon as any} size={20} color={meta.color} />
                </View>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealTitle}>{mealLabel}</Text>
                  <Text style={styles.mealType}>{meta.label}</Text>
                  <View style={styles.mealItems}>
                    {entry.items.map((item, i) => (
                      <Text key={i} style={styles.mealItemText}>{item.name}{item.quantity ? ` (${item.quantity})` : ''}</Text>
                    ))}
                  </View>
                  {entry.notes ? <Text style={styles.mealNote}>{entry.notes}</Text> : null}
                </View>
                <View style={styles.mealStats}>
                  <Text style={styles.mealCal}>{mealCal} cal</Text>
                  <Text style={styles.mealProt}>{mealProt}g P</Text>
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
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.reportLoadingText}>Generating daily report...</Text>
              </View>
            ) : !showReport ? (
              <TouchableOpacity style={styles.reportBtn} onPress={generateDailyReport} activeOpacity={0.8}>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.reportBtnText}>Generate Daily Report</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Ionicons name="sparkles" size={16} color={colors.primary} />
                  <Text style={styles.reportTitle}>Daily Report</Text>
                  <TouchableOpacity onPress={() => setShowReport(false)}>
                    <Ionicons name="close-circle" size={18} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.reportText}>{dailyReport}</Text>
                <TouchableOpacity style={styles.reportRefresh} onPress={generateDailyReport}>
                  <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                  <Text style={styles.reportRefreshText}>Regenerate</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Log Options Bottom Sheet */}
      <Modal visible={showLogOptions} transparent animationType="slide" onRequestClose={() => setShowLogOptions(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.optionsSheet}>
            <View style={styles.optionsHandle} />
            <Text style={styles.modalTitle}>Log Meal</Text>

            <TouchableOpacity style={styles.optionCard} onPress={handleTakePhoto} activeOpacity={0.7}>
              <View style={[styles.optionIconBox, { backgroundColor: `${colors.primary}20` }]}>
                <Ionicons name="camera-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Take Photo</Text>
                <Text style={styles.optionSubtitle}>AI will analyze your meal photo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionCard} onPress={handlePickGallery} activeOpacity={0.7}>
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(59,130,246,0.2)' }]}>
                <Ionicons name="images-outline" size={22} color="#3b82f6" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Pick from Gallery</Text>
                <Text style={styles.optionSubtitle}>Choose an existing meal photo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionCard} onPress={handleDescribeMeal} activeOpacity={0.7}>
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
                <Ionicons name="text-outline" size={22} color="#f59e0b" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Describe Meal</Text>
                <Text style={styles.optionSubtitle}>Type what you ate, AI estimates calories</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>

            <View style={styles.optionsDivider} />

            <TouchableOpacity style={styles.optionCard} onPress={handleManualEntry} activeOpacity={0.7}>
              <View style={[styles.optionIconBox, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                <Ionicons name="create-outline" size={22} color={colors.onSurfaceVariant} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Enter Manually</Text>
                <Text style={styles.optionSubtitle}>Add food items and nutrition manually</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLogOptions(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.datePickerCard}>
            <Text style={styles.datePickerTitle}>Select Date</Text>
            <TextInput
              style={styles.datePickerInput}
              value={selectedDate}
              onChangeText={(v) => { if (/^\d{0,4}-?\d{0,2}-?\d{0,2}$/.test(v)) setSelectedDate(v); }}
              onBlur={() => {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) setSelectedDate(getTodayDateString());
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.onSurfaceVariant}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            <View style={styles.datePickerActions}>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => { setSelectedDate(getTodayDateString()); setShowDatePicker(false); }}>
                <Text style={styles.datePickerBtnText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => { setSelectedDate(addDays(getTodayDateString(), -1)); setShowDatePicker(false); }}>
                <Text style={styles.datePickerBtnText}>Yesterday</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.datePickerBtn, styles.datePickerBtnPrimary]} onPress={() => setShowDatePicker(false)}>
                <Text style={[styles.datePickerBtnText, { color: '#fff' }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Targets Modal */}
      <Modal visible={showTargets} transparent animationType="fade" onRequestClose={() => setShowTargets(false)}>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.targetsModal}>
            <Text style={styles.targetsTitle}>Daily Targets</Text>
            <View style={styles.targetField}>
              <Text style={styles.targetLabel}>Calorie Target</Text>
              <TextInput style={styles.targetInput} value={targetCal} onChangeText={setTargetCal} keyboardType="number-pad" placeholderTextColor={colors.onSurfaceVariant} />
            </View>
            <View style={styles.targetField}>
              <Text style={styles.targetLabel}>Protein Target (g)</Text>
              <TextInput style={styles.targetInput} value={targetProt} onChangeText={setTargetProt} keyboardType="number-pad" placeholderTextColor={colors.onSurfaceVariant} />
            </View>
            <View style={styles.targetField}>
              <Text style={styles.targetLabel}>Carbs Target (g)</Text>
              <TextInput style={styles.targetInput} value={targetCarbs} onChangeText={setTargetCarbs} keyboardType="number-pad" placeholderTextColor={colors.onSurfaceVariant} />
            </View>
            <View style={styles.targetField}>
              <Text style={styles.targetLabel}>Fat Target (g)</Text>
              <TextInput style={styles.targetInput} value={targetFat} onChangeText={setTargetFat} keyboardType="number-pad" placeholderTextColor={colors.onSurfaceVariant} />
            </View>
            <View style={styles.targetField}>
              <Text style={styles.targetLabel}>Water Target (L)</Text>
              <TextInput style={styles.targetInput} value={targetWater} onChangeText={setTargetWater} keyboardType="decimal-pad" placeholderTextColor={colors.onSurfaceVariant} />
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTargets}>
              <Text style={styles.saveBtnText}>Save Targets</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTargets(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Floating AI Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => (navigation as any).navigate('MealAISuggestions')}
        activeOpacity={0.85}
      >
        <Ionicons name="sparkles" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0 },
  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 64, paddingHorizontal: spacing.containerPadding, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  appBarCenter: { alignItems: 'center' },
  appBarTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  dateBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.containerPadding, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  dateBarText: { fontSize: 15, fontWeight: '700', color: colors.onSurfaceVariant },
  dateArrowBig: { padding: 6 },
  iconBtn: { padding: 8, borderRadius: rounded.full },
  iconBtnSm: { padding: 6 },
  scroll: { padding: spacing.containerPadding, gap: 14, paddingBottom: 40 },
  progressCard: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.lg, padding: 16, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  progressItem: { gap: 6 },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressLabel: { fontSize: 13, fontWeight: '600', color: colors.onSurface, flex: 1 },
  progressValue: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
  progressBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  macroRow: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  macroChip: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  macroVal: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  macroLabel: { fontSize: 10, color: colors.onSurfaceVariant, marginTop: 2 },
  weekCard: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.lg, padding: 16, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  weekHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weekTitle: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6, flex: 1 },
  graphToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: rounded.full, padding: 2 },
  toggleChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: rounded.full },
  toggleChipActive: { backgroundColor: colors.primaryContainer },
  toggleChipText: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant },
  toggleChipTextActive: { color: '#fff' },
  graphLegend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 10, color: colors.onSurfaceVariant },
  addMealBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primaryContainer, paddingVertical: 14, borderRadius: rounded.lg },
  addMealText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  sectionTitle: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6, marginTop: 4 },
  emptyText: { fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 20 },
  mealCard: { flexDirection: 'row', backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, padding: 12, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  mealIconBox: { width: 42, height: 42, borderRadius: rounded.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  mealInfo: { flex: 1, gap: 4 },
  mealTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  mealType: { fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '500' },
  mealItems: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 3 },
  mealItemText: { fontSize: 12, color: colors.onSurfaceVariant },
  mealNote: { fontSize: 11, color: colors.onSurfaceVariant, fontStyle: 'italic' },
  mealStats: { alignItems: 'flex-end', gap: 2 },
  mealCal: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  mealProt: { fontSize: 11, color: colors.success, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center', marginBottom: 16 },
  optionsSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 },
  optionsHandle: { width: 36, height: 4, backgroundColor: colors.outline, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  optionIconBox: { width: 44, height: 44, borderRadius: rounded.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  optionInfo: { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  optionSubtitle: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  optionsDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 6 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  cancelBtnText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primaryContainer, paddingVertical: 14, borderRadius: rounded.lg, alignItems: 'center', marginTop: 12 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  datePickerCard: { backgroundColor: colors.surface, borderRadius: rounded.lg, padding: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  datePickerTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center', marginBottom: 16 },
  datePickerInput: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, height: 48, paddingHorizontal: 14, color: colors.onSurface, fontSize: 18, fontWeight: '600', textAlign: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  datePickerActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  datePickerBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT },
  datePickerBtnPrimary: { backgroundColor: colors.primaryContainer },
  datePickerBtnText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  targetsModal: { backgroundColor: colors.surface, borderRadius: rounded.lg, padding: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  targetsTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center', marginBottom: 16 },
  targetField: { gap: 6, marginBottom: 12 },
  targetLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  targetInput: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.DEFAULT, height: 44, paddingHorizontal: 14, color: colors.onSurface, fontSize: 16, fontWeight: '600', textAlign: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  reportSection: { marginTop: 4 },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primaryContainer, paddingVertical: 14, borderRadius: rounded.lg },
  reportBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  reportLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  reportLoadingText: { fontSize: 13, color: colors.onSurfaceVariant },
  reportCard: { backgroundColor: colors.surfaceContainer, borderRadius: rounded.lg, padding: 16, gap: 10, borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)' },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reportTitle: { fontSize: 13, fontWeight: '700', color: colors.onSurface, flex: 1 },
  reportText: { fontSize: 12, color: colors.onSurface, lineHeight: 19 },
  reportRefresh: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 },
  reportRefreshText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: rounded.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
  },
});
