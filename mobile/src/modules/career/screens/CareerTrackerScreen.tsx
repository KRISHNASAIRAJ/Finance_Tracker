/**
 * CareerTrackerScreen — Career milestone timeline with graph, event list, and delete confirm.
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useCareerStore, CareerEvent } from '../store';
import { useAuth } from '../../../services/AuthProvider';
import CareerGraph from './CareerGraph';

type NavProp = NativeStackNavigationProp<any>;

export default function CareerTrackerScreen() {
  const navigation = useNavigation<NavProp>();
  const { events, deleteEvent } = useCareerStore();
  const { user } = useAuth();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

  const typeConfig: Record<string, { color: string; label: string; icon: string }> = {
    up: { color: colors.success, label: 'Up', icon: 'trending-up' },
    down: { color: colors.error, label: 'Down', icon: 'trending-down' },
    balance: { color: colors.secondary, label: 'Flat', icon: 'remove' },
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Career Track</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate('AddCareerEvent' as any)}
        >
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Graph */}
        {events.length >= 2 ? (
          <View style={styles.graphCard}>
            <Text style={styles.graphTitle}>Trajectory</Text>
            <CareerGraph events={events} />
          </View>
        ) : events.length === 1 ? (
          <View style={styles.graphCard}>
            <Text style={styles.graphTitle}>Trajectory</Text>
            <Text style={styles.emptyGraph}>Add at least one more event to see your career graph</Text>
          </View>
        ) : (
          <View style={styles.graphCard}>
            <Text style={styles.emptyGraph}>Tap + to add your first career event</Text>
          </View>
        )}

        {/* Events Timeline */}
        <Text style={styles.sectionTitle}>TIMELINE</Text>
        {events.length === 0 ? (
          <Text style={styles.emptyText}>No events yet</Text>
        ) : (
          events.map((evt, i) => {
            const cfg = typeConfig[evt.type];
            return (
              <View key={evt.id} style={styles.eventRow}>
                <View style={styles.timelineLine}>
                  <View style={[styles.dot, { backgroundColor: cfg.color }]} />
                  {i < events.length - 1 && <View style={styles.connector} />}
                </View>
                <TouchableOpacity
                  style={[styles.eventCard, { borderLeftColor: cfg.color }]}
                  onPress={() =>
                    navigation.navigate('AddCareerEvent' as any, { eventId: evt.id })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.eventHeader}>
                    <View style={styles.eventNameRow}>
                      <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                      <Text style={styles.eventName} numberOfLines={1}>{evt.name}</Text>
                    </View>
                    <Text style={[styles.eventTypeLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <Text style={styles.eventDate}>{formatDate(evt.date)}</Text>
                  {evt.notes ? (
                    <Text style={styles.eventNotes} numberOfLines={2}>{evt.notes}</Text>
                  ) : null}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  appBarTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  iconBtn: { padding: 8, borderRadius: rounded.full },
  scroll: { padding: spacing.containerPadding, gap: 16, paddingBottom: 40 },
  graphCard: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  graphTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface, marginBottom: 12 },
  emptyGraph: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 },
  sectionTitle: { fontSize: 10, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.6, marginTop: 4 },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: 12 },
  eventRow: { flexDirection: 'row', gap: 10 },
  timelineLine: { alignItems: 'center', width: 20 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  connector: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 },
  eventCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: rounded.DEFAULT,
    padding: 12,
    borderLeftWidth: 3,
    gap: 6,
  },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  eventName: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  eventTypeLabel: { fontSize: 11, fontWeight: '700' },
  eventDate: { fontSize: 11, color: colors.textSecondary },
  eventNotes: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
});
