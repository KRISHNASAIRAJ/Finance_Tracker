import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useCareerStore } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import DateTimePicker from '../../../shared/components/DateTimePicker';

type RouteParams = {
  AddCareerEvent: { eventId?: string };
};

const TYPES = [
  { key: 'up' as const, label: 'Up', color: colors.success, icon: 'trending-up' },
  { key: 'down' as const, label: 'Down', color: colors.error, icon: 'trending-down' },
  { key: 'balance' as const, label: 'Flat', color: colors.secondary, icon: 'remove' },
];

export default function AddCareerEventScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'AddCareerEvent'>>();
  const eventId = route.params?.eventId;
  const { events, addEvent, editEvent } = useCareerStore();
  const { user } = useAuth();

  const existing = eventId ? events.find((e) => e.id === eventId) : null;

  const [name, setName] = useState(existing?.name || '');
  const [type, setType] = useState<'up' | 'down' | 'balance'>(existing?.type || 'up');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [date, setDate] = useState(existing ? new Date(existing.date) : new Date());
  const [showPicker, setShowPicker] = useState(false);

  const handleSave = () => {
    if (!name.trim()) { alert('Please enter an event name'); return; }

    if (existing) {
      editEvent(existing.id, {
        name: name.trim(),
        type,
        notes: notes.trim(),
        date: date.toISOString(),
      }, user?.id);
    } else {
      addEvent({
        name: name.trim(),
        date: date.toISOString(),
        type,
        notes: notes.trim(),
      }, user?.id);
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{existing ? 'Edit Event' : 'Add Event'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.field}>
          <Text style={styles.label}>EVENT NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Got Promotion, Lost Job..."
            placeholderTextColor={colors.onSurfaceVariant}
            autoFocus={!existing}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>TYPE</Text>
          <View style={styles.typeRow}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.typeChip,
                  type === t.key && { backgroundColor: `${t.color}20`, borderColor: t.color },
                ]}
                onPress={() => setType(t.key)}
              >
                <Ionicons name={t.icon as any} size={16} color={type === t.key ? t.color : colors.onSurfaceVariant} />
                <Text style={[styles.typeText, type === t.key && { color: t.color, fontWeight: '700' }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>DATE</Text>
          <TouchableOpacity
            style={styles.dateTrigger}
            onPress={() => setShowPicker(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.dateText}>
              {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>NOTES (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any extra context..."
            placeholderTextColor={colors.onSurfaceVariant}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.saveText}>{existing ? 'Update Event' : 'Save Event'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <DateTimePicker
        visible={showPicker}
        selected={date}
        onSelect={(d) => { setDate(d); setShowPicker(false); }}
        onClose={() => setShowPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  iconBtn: { padding: 8, borderRadius: rounded.full },
  scroll: { padding: spacing.containerPadding, gap: 20, paddingBottom: 40 },
  field: { gap: 8 },
  label: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  input: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 48,
    paddingHorizontal: 14,
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: '500',
  },
  notesInput: { height: 80, paddingTop: 12 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: rounded.DEFAULT,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  typeText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceContainer,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 44,
    paddingHorizontal: 14,
  },
  dateText: { fontSize: 14, color: colors.onSurface, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryContainer,
    paddingVertical: 16,
    borderRadius: rounded.lg,
    marginTop: 8,
  },
  saveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
