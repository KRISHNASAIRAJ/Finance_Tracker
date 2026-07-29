import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useWeightStore, WeightEntry } from '../weightStore';
import { useAuth } from '../../../services/AuthProvider';
import { getTodayDateString } from '../../../shared/istDate';

export default function WeightTrackerScreen() {
  const navigation = useNavigation();
  const entries = useWeightStore((s) => s.entries) || [];
  const addEntry = useWeightStore((s) => s.addEntry);
  const editEntry = useWeightStore((s) => s.editEntry);
  const deleteEntry = useWeightStore((s) => s.deleteEntry);
  const { user } = useAuth();

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(getTodayDateString());
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [entries]);

  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const change = latest && prev ? (latest.weightKg - prev.weightKg).toFixed(1) : null;

  // Chart calculations
  const CHART_W = 340;
  const CHART_H = 160;
  const padX = 30;
  const padY = 30;

  const weights = sorted.map((e) => e.weightKg);
  const maxW = weights.length > 0 ? Math.max(...weights) : 100;
  const minW = weights.length > 0 ? Math.min(...weights) : 0;
  const range = maxW - minW || 1;
  const norm = (v: number) => (v - minW) / range;

  const targetWeight = 65;

  const allVals = targetWeight > 0 ? [...weights, targetWeight] : weights;
  const globalMax = Math.max(...allVals);
  const globalMin = Math.min(...allVals);
  const globalRange = globalMax - globalMin || 1;

  const points = sorted.map((s, i) => {
    const x = padX + (i / Math.max(sorted.length - 1, 1)) * (CHART_W - 2 * padX);
    const y = CHART_H - padY - ((s.weightKg - globalMin) / globalRange) * (CHART_H - 2 * padY);
    return { x, y, label: s.date, value: s.weightKg };
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

  // Target line Y position
  const targetY = targetWeight > 0
    ? CHART_H - padY - ((targetWeight - globalMin) / globalRange) * (CHART_H - 2 * padY)
    : null;

  const [selectedIndex, setSelectedIndex] = useState(points.length > 0 ? points.length - 1 : -1);

  const openAdd = () => {
    setEditingId(null);
    setDate(getTodayDateString());
    setWeight('');
    setNote('');
    setShowAdd(true);
  };

  const openEdit = (entry: WeightEntry) => {
    setEditingId(entry.id);
    setDate(entry.date);
    setWeight(entry.weightKg.toString());
    setNote(entry.notes || '');
    setShowAdd(true);
  };

  const handleSave = () => {
    const w = parseFloat(weight);
    if (!w || w <= 0) {
      alert('Enter a valid weight');
      return;
    }

    if (editingId) {
      editEntry(editingId, { date, weightKg: w, notes: note }, user?.id);
    } else {
      addEntry(date, w, note, user?.id);
    }

    setShowAdd(false);
    setEditingId(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.appBarCenter}>
          <Text style={styles.appBarTitle}>Weight Tracker</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        {latest && (
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>CURRENT WEIGHT</Text>
            <View style={styles.heroRow}>
              <Text style={styles.heroValue}>{latest.weightKg.toFixed(1)}</Text>
              <Text style={styles.heroUnit}>kg</Text>
            </View>
            <View style={styles.heroMeta}>
              {change && (
                <View style={styles.changeRow}>
                  <Ionicons
                    name={parseFloat(change) >= 0 ? 'trending-up' : 'trending-down'}
                    size={14}
                    color={parseFloat(change) >= 0 ? colors.error : colors.success}
                  />
                  <Text style={[styles.changeText, { color: parseFloat(change) >= 0 ? colors.error : colors.success }]}>
                    {parseFloat(change) >= 0 ? '+' : ''}{change} kg
                  </Text>
                </View>
              )}
              {targetWeight > 0 && (
                <Text style={styles.targetText}>
                  Target: {targetWeight} kg at ~0.4 kg/wk
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Chart */}
        {points.length > 1 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>WEIGHT OVER TIME</Text>
            <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
              <Defs>
                <LinearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.25" />
                  <Stop offset="100%" stopColor={colors.primary} stopOpacity="0.0" />
                </LinearGradient>
              </Defs>
              {targetY !== null && (
                <Line
                  x1={padX}
                  y1={targetY}
                  x2={CHART_W - padX}
                  y2={targetY}
                  stroke={colors.success}
                  strokeWidth="1.5"
                  strokeDasharray="6,4"
                />
              )}
              <Path d={fillD} fill="url(#wGrad)" />
              <Path d={pathD} stroke={colors.primary} strokeWidth="2.5" fill="none" strokeLinecap="round" />
              {selectedIndex >= 0 && selectedIndex < points.length && (
                <Circle cx={points[selectedIndex].x} cy={points[selectedIndex].y} r="4" fill={colors.primary} />
              )}
            </Svg>
            {targetY !== null && (
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                <Text style={styles.legendText}>Target: {targetWeight} kg</Text>
              </View>
            )}
          </View>
        )}

        {/* Add Button */}
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
          <Ionicons name="add-circle" size={20} color={colors.onSurface} />
          <Text style={styles.addBtnText}>Log Weight</Text>
        </TouchableOpacity>

        {/* History */}
        <Text style={styles.sectionTitle}>WEIGHT HISTORY</Text>
        {sorted.length === 0 ? (
          <Text style={styles.emptyText}>No weight entries yet</Text>
        ) : (
          [...sorted].reverse().map((entry) => {
              const bmi = (entry.weightKg / (1.706 * 1.706)).toFixed(1);
            return (
              <TouchableOpacity key={entry.id} style={styles.entryCard} onPress={() => openEdit(entry)} activeOpacity={0.7}>
                <View style={styles.entryIcon}>
                  <Ionicons name="scale-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryDate}>
                    {new Date(entry.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                  {entry.notes ? <Text style={styles.entryNote} numberOfLines={1}>{entry.notes}</Text> : null}
                </View>
                <View style={styles.entryStats}>
                  <Text style={styles.entryWeight}>{entry.weightKg.toFixed(1)} kg</Text>
                  <Text style={styles.entryBmi}>BMI {bmi}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Weight' : 'Log Weight'}</Text>

            <Text style={styles.fieldLabel}>Date</Text>
            <TextInput
              style={styles.fieldInput}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <Text style={styles.fieldLabel}>Weight (kg)</Text>
            <TextInput
              style={styles.fieldInput}
              value={weight}
              onChangeText={setWeight}
              placeholder="e.g. 54.5"
              placeholderTextColor={colors.onSurfaceVariant}
              keyboardType="decimal-pad"
            />

            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={styles.fieldInput}
              value={note}
              onChangeText={setNote}
              placeholder="Optional"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            {editingId ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.saveBtn, { flex: 1, backgroundColor: colors.errorContainer }]}
                  onPress={() => { deleteEntry(editingId, user?.id); setShowAdd(false); }}
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

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
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
  heroCard: {     backgroundColor: colors.surface, borderRadius: rounded.lg, padding: 20, alignItems: 'center', gap: 6,     borderWidth: StyleSheet.hairlineWidth,     borderColor: colors.border, },
  heroLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  heroValue: { fontSize: 40, fontWeight: '800', color: colors.onSurface, letterSpacing: -1 },
  heroUnit: { fontSize: 16, color: colors.onSurfaceVariant, fontWeight: '600' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  changeText: { fontSize: 13, fontWeight: '600' },
  targetText: { fontSize: 11, color: colors.onSurfaceVariant },
  chartCard: {     backgroundColor: colors.surface, borderRadius: rounded.lg, padding: 16, gap: 8,     borderWidth: StyleSheet.hairlineWidth,     borderColor: colors.border, },
  chartTitle: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.onSurfaceVariant },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primaryContainer, paddingVertical: 14, borderRadius: rounded.lg },
  addBtnText: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  sectionTitle: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6, marginTop: 4 },
  emptyText: { fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 20 },
  entryCard: { flexDirection: 'row',     backgroundColor: colors.surface, borderRadius: rounded.DEFAULT, padding: 12, gap: 12,     borderWidth: StyleSheet.hairlineWidth,     borderColor: colors.border, alignItems: 'center' },
  entryIcon: { width: 40, height: 40, borderRadius: rounded.DEFAULT,     backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  entryInfo: { flex: 1, gap: 2 },
  entryDate: { fontSize: 13, fontWeight: '600', color: colors.onSurface },
  entryNote: { fontSize: 11, color: colors.onSurfaceVariant },
  entryStats: { alignItems: 'flex-end', gap: 2 },
  entryWeight: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  entryBmi: { fontSize: 11, color: colors.onSurfaceVariant },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center', marginBottom: 16 },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6, marginBottom: 4, marginTop: 8 },
  fieldInput: {     backgroundColor: colors.surface, borderRadius: rounded.DEFAULT, height: 44, paddingHorizontal: 14, color: colors.onSurface, fontSize: 15, fontWeight: '500',     borderWidth: StyleSheet.hairlineWidth,     borderColor: colors.border, },
  saveBtn: { backgroundColor: colors.primaryContainer, paddingVertical: 14, borderRadius: rounded.lg, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  cancelBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  cancelBtnText: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
});
