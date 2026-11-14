/**
 * NotificationsScreen — In-app notification inbox with relative timestamps and read state.
 *
 * Restyled to the Meridian v2 reference (s26): a back bar with "Read all"
 * and clear actions, TODAY / EARLIER sections, and read rows dimmed out.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SectionList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import { EmptyState, IconTile, Label, PressScale, Screen, TopBar } from '../../../shared/components/meridian';
import { useFinanceStore } from '../../finance/store';

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { notifications, markNotificationRead, markAllNotificationsRead, clearNotifications } = useFinanceStore();

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert('Clear Notifications', 'Remove all notifications? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: clearNotifications },
    ]);
  };

  const getRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Group into TODAY / EARLIER by real timestamps
  const today = new Date();
  const todayKey = today.toDateString();
  const todays = notifications.filter((n) => new Date(n.date).toDateString() === todayKey);
  const earlier = notifications.filter((n) => new Date(n.date).toDateString() !== todayKey);
  const sections = [
    ...(todays.length > 0 ? [{ title: 'TODAY', data: todays }] : []),
    ...(earlier.length > 0 ? [{ title: 'EARLIER', data: earlier }] : []),
  ];

  const rightSlot = (
    <View style={styles.topBarRight}>
      <PressScale onPress={markAllNotificationsRead} scale={0.94} style={styles.readAllBtn} accessibilityLabel="Read all">
        <Text style={styles.readAllText}>Read all</Text>
      </PressScale>
      <PressScale
        onPress={handleClearAll}
        scale={0.94}
        style={[styles.clearBtn, notifications.length === 0 && styles.clearBtnDisabled]}
        accessibilityLabel="Clear notifications"
      >
        <Ionicons name="trash-outline" size={15} color={mc.redSoft} />
      </PressScale>
    </View>
  );

  return (
    <Screen scroll={false} bottomInset={0}>
      <TopBar title="Notifications" onBack={() => navigation.goBack()} variant="center" right={rightSlot} />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Label style={styles.sectionLabel}>{section.title}</Label>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.read && styles.cardUnread]}
            activeOpacity={0.8}
            onPress={() => markNotificationRead(item.id)}
            accessibilityLabel={item.read ? item.title : `${item.title} (unread)`}
          >
            <IconTile
              icon="notifications-outline"
              color={item.read ? mc.textFaint : mc.amber}
              background={item.read ? mc.raised : mc.amberDim}
              size={38}
            />
            <View style={styles.cardMain}>
              <View style={styles.cardHeader}>
                <View style={styles.titleWrap}>
                  {!item.read ? <View style={styles.unreadDot} /> : null}
                  <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <Text style={styles.timeText}>{getRelativeTime(item.date)}</Text>
              </View>
              <Text style={styles.bodyText} numberOfLines={3}>{item.body}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="You are all caught up"
            subtitle="No new notifications to display"
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readAllBtn: {
    backgroundColor: mc.raised,
    borderRadius: mr.chip,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  readAllText: {
    fontSize: 13,
    color: mc.text,
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: mc.redDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnDisabled: {
    opacity: 0.4,
  },
  listContainer: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 8,
  },
  sectionLabel: {
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 2,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: mc.card,
    borderRadius: mr.row,
    padding: 14,
    opacity: 0.6,
    marginBottom: 8,
  },
  cardUnread: {
    opacity: 1,
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    minWidth: 0,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: mc.redSoft,
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: 15,
    color: mc.text,
    flexShrink: 1,
  },
  cardTitleUnread: {
    fontWeight: '500',
  },
  timeText: {
    fontSize: 11,
    color: mc.textDim,
    flexShrink: 0,
  },
  bodyText: {
    fontSize: 13,
    color: mc.textDim,
    lineHeight: 19,
    marginTop: 4,
  },
});
