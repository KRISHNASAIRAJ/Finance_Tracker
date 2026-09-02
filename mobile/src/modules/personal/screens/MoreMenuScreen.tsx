/**
 * MoreMenuScreen — Settings hub with backup, sync, notifications, and module shortcuts.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore } from '../../finance/store';
import { triggerBackupNow } from '../../../services/backupScheduler';
import { MoreStackParamList } from '../../../navigation/RootNavigator';
import { useAuth } from '../../../services/AuthProvider';
import { syncNow } from '../../finance/hooks/useFinanceSync';
import { usePersonalSync, syncPersonalNow } from '../hooks/usePersonalSync';
import { useEquitySync, syncEquityNow } from '../../equity/hooks/useEquitySync';
import { useTasksSync, syncTasksNow } from '../../tasks/hooks/useTasksSync';
import { supabase, SUPABASE_URL } from '../../../services/supabaseClient';
import { processSyncQueue, getSyncStatus, onSyncStatusChange, type SyncStatus } from '../../../services/syncQueue';
import { generateMonthlyReport } from '../../../services/reportService';
import { useInvestmentsStore } from '../../equity/store';
import { usePersonalStore } from '../store';
import EKGLoader from '../../../shared/components/EKGLoader';
import SyncReconcile from '../../../shared/components/SyncReconcile';
import SyncStatusCard from '../../../shared/components/SyncStatusCard';

type NavigationProp = NativeStackNavigationProp<MoreStackParamList, 'MoreMenu'>;

const ICON_COLOR = '#FFFFFF';

export default function MoreMenuScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, signIn, signOut } = useAuth();
  const { pullFromCloud: pullPersonal } = usePersonalSync();
  const { pullFromCloud: pullEquity } = useEquitySync();
  const { pullFromCloud: pullTasks } = useTasksSync();
  const scrollRef = useRef<ScrollView>(null);
  const modalAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      pullPersonal();
      pullEquity();
      pullTasks();
      processSyncQueue().catch((e: Error) => console.warn('[MoreMenu] syncQueue flush failed:', e));
    }, [pullPersonal, pullEquity, pullTasks])
  );
  const notifications = useFinanceStore((state) => state.notifications);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const [backupState, setBackupState] = useState<'idle' | 'backing' | 'done' | 'error'>('idle');
  const [showAuth, setShowAuth] = useState(false);
  const [kiteSyncing, setKiteSyncing] = useState(false);
  const [kiteSyncResult, setKiteSyncResult] = useState<string | null>(null);
  const [kiteConnected, setKiteConnected] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [syncResultMsg, setSyncResultMsg] = useState<string | null>(null);

  React.useEffect(() => {
    const unsub = onSyncStatusChange(setSyncStatus);
    return unsub;
  }, []);

  const financeLastSync = useFinanceStore((s) => s.lastSyncedAt);
  const equityLastSync = useInvestmentsStore((s) => s.lastEquitySyncedAt);
  const personalLastSync = usePersonalStore((s) => s.lastPersonalSyncedAt);

  const lastSyncedAt = useMemo(() => {
    const candidates = [financeLastSync, equityLastSync, personalLastSync].filter(Boolean) as string[];
    if (candidates.length === 0) return null;
    return candidates.reduce((latest, c) => (new Date(c).getTime() > new Date(latest).getTime() ? c : latest));
  }, [financeLastSync, equityLastSync, personalLastSync]);

  const syncPhase = syncing
    ? 'spending'
    : syncStatus.lastError && syncStatus.queueCount > 0
      ? 'recovering'
      : syncStatus.queueCount > 0
        ? 'recovering'
        : syncStatus.lastError
          ? 'idle'
          : 'synced';

  const monthlyBudget = useFinanceStore((s) => s.monthlyBudget);
  const setMonthlyBudget = useFinanceStore((s) => s.setMonthlyBudget);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  useEffect(() => {
    if (budgetModalVisible) {
      modalAnim.setValue(0);
      Animated.spring(modalAnim, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(modalAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [budgetModalVisible, modalAnim]);

  const handleSyncNow = async () => {
    if (!user || syncing) return;
    setSyncing(true);
    setSyncResultMsg(null);
    const pqResult = await processSyncQueue(true /* force — ignore backoff */);
    await syncNow(user.id);
    await syncPersonalNow(user.id);
    await syncEquityNow(user.id);
    await syncTasksNow(user.id);
    const status = getSyncStatus();
    if (pqResult.error) {
      setSyncResultMsg(pqResult.error);
    } else if (pqResult.failed > 0) {
      setSyncResultMsg(`Synced ${pqResult.succeeded}, ${pqResult.failed} failed, ${status.queueCount} pending`);
    } else if (pqResult.succeeded > 0) {
      setSyncResultMsg(`Synced ${pqResult.succeeded} items${status.queueCount > 0 ? `, ${status.queueCount} pending` : ''}`);
    } else if (status.queueCount > 0) {
      setSyncResultMsg(`${status.queueCount} items still pending — check your connection`);
    } else {
      setSyncResultMsg('Up to date');
    }
    setSyncing(false);
    setTimeout(() => setSyncResultMsg(null), 8000);
  };

  const handleBackupNow = async () => {
    setBackupState('backing');
    try {
      await triggerBackupNow();
      setBackupState('done');
      setTimeout(() => setBackupState('idle'), 2000);
    } catch {
      setBackupState('error');
      setTimeout(() => setBackupState('idle'), 2000);
    }
  };

  const handleMonthlyReport = async () => {
    setBackupState('backing');
    await generateMonthlyReport();
    setBackupState('idle');
  };

  const GRID_SECTIONS: {
    title: string;
    items: {
      id: string;
      label: string;
      icon: string;
      onPress: () => void;
    }[];
  }[] = [
    {
      title: 'UTILITIES',
      items: [
        {
          id: 'notes',
          label: 'Personal Notes',
          icon: 'document-text-outline',
          onPress: () => navigation.navigate('PersonalNotes'),
        },
        {
          id: 'diary',
          label: 'Weekly Diary',
          icon: 'journal-outline',
          onPress: () => navigation.navigate('WeeklyDiary'),
        },
      ],
    },
    {
      title: 'GOALS & GROWTH',
      items: [
        {
          id: 'goals',
          label: '2026 Goal Tracker',
          icon: 'ribbon-outline',
          onPress: () => navigation.navigate('GoalsTracker'),
        },
        {
          id: 'career',
          label: 'Career Track',
          icon: 'trending-up-outline',
          onPress: () => navigation.navigate('CareerTracker'),
        },
      ],
    },
    {
      title: 'HEALTH',
      items: [
        {
          id: 'meals',
          label: 'Meal Logger',
          icon: 'restaurant-outline',
          onPress: () => navigation.navigate('MealLogger'),
        },
        {
          id: 'weight',
          label: 'Weight Tracker',
          icon: 'scale-outline',
          onPress: () => navigation.navigate('WeightTracker'),
        },
        {
          id: 'dietview',
          label: 'Project 65 Diet',
          icon: 'fitness-outline',
          onPress: () => navigation.navigate('DietViewer'),
        },
        {
          id: 'recipes',
          label: 'Recipes Library',
          icon: 'book-outline',
          onPress: () => navigation.navigate('RecipesLibrary'),
        },
      ],
    },
  ];

  const handleConnectKite = () => {
    const apiKey = process.env.EXPO_PUBLIC_KITE_API_KEY || '';
    console.log('[KiteConnect] apiKey:', apiKey ? apiKey.substring(0, 6) + '...' : 'EMPTY');
    if (!apiKey || apiKey === 'YOUR_KITE_API_KEY_HERE') {
      setKiteSyncResult('Set EXPO_PUBLIC_KITE_API_KEY in .env');
      setTimeout(() => setKiteSyncResult(null), 3000);
      return;
    }
    const supabaseFnUrl = `${SUPABASE_URL}/functions/v1`;
    const redirectUri = `${supabaseFnUrl}/kite-callback`;
    const stateParam = user ? encodeURIComponent(user.id) : 'unknown';
    const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${stateParam}`;
    console.log('[KiteConnect] Opening:', loginUrl.substring(0, 80) + '...');
    Linking.openURL(loginUrl);
  };

  const handleKiteSync = async () => {
    if (!user || kiteSyncing) return;
    setKiteSyncing(true);
    setKiteSyncResult(null);
    try {
      const supabaseFnUrl = `${SUPABASE_URL}/functions/v1`;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(
        `${supabaseFnUrl}/kite-holdings-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token ?? ''}`,
          },
          body: JSON.stringify({ user_id: user.id }),
        }
      );
      const data = await res.json();
      if (data.error) {
        const err = data.error.toLowerCase();
        if (err.includes('incorrect') || err.includes('api_key') || err.includes('access_token')) {
          setKiteSyncResult('Token expired — tap "Connect Kite" to re-authenticate');
        } else {
          setKiteSyncResult(data.error);
        }
      } else if (!res.ok) {
        setKiteSyncResult('Server error');
      } else {
        setKiteSyncResult(`${data.synced} equity + ${data.mfSynced} MF synced`);
        setKiteConnected(true);
        await syncEquityNow(user.id);
      }
    } catch (e: any) {
      setKiteSyncResult(e.message || 'Sync failed');
    } finally {
      setKiteSyncing(false);
      setTimeout(() => setKiteSyncResult(null), 6000);
    }
  };

  const handleDisconnectKite = async () => {
    if (!user) return;
    Alert.alert(
      'Disconnect Kite',
      'This will remove your Zerodha connection. You can reconnect anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('kite_tokens').delete().or(`user_id.eq.${user.id},user_id.eq.default`);
              if (error) {
                Alert.alert('Error', 'Failed to disconnect: ' + error.message);
              } else {
                setKiteConnected(false);
                setKiteSyncResult('Disconnected');
                setTimeout(() => setKiteSyncResult(null), 3000);
              }
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Disconnect failed');
            }
          },
        },
      ]
    );
  };

  const TOOL_ITEMS: {
    id: string;
    label: string;
    icon?: string;
    iconColor?: string;
    spinner?: boolean;
    disabled?: boolean;
    onPress: () => void;
  }[] = [
    {
      id: 'cardchat',
      label: 'AI Card Chat',
      icon: 'sparkles-outline',
      iconColor: ICON_COLOR,
      onPress: () => (navigation as any).navigate('MainTabs', { screen: 'FinanceTab', params: { screen: 'CardChat' } }),
    },
    {
      id: 'report',
      label: 'Monthly Report',
      icon: 'document-text-outline',
      iconColor: ICON_COLOR,
      onPress: handleMonthlyReport,
    },
    {
      id: 'combined-report',
      label: 'Combined Report',
      icon: 'bar-chart-outline',
      iconColor: ICON_COLOR,
      onPress: () => navigation.navigate('CombinedReport'),
    },
    {
      id: 'backup',
      label:
        backupState === 'backing' ? 'Backing up...' :
        backupState === 'done' ? 'Backup saved' :
        backupState === 'error' ? 'Backup failed' : 'Backup Now',
      icon:
        backupState === 'done' ? 'checkmark-circle' :
        backupState === 'error' ? 'alert-circle' : 'cloud-upload-outline',
      iconColor:
        backupState === 'done' ? colors.success :
        backupState === 'error' ? colors.error : ICON_COLOR,
      spinner: backupState === 'backing',
      disabled: backupState === 'backing',
      onPress: handleBackupNow,
    },
    {
      id: 'budget',
      label: 'Monthly Budget',
      icon: 'wallet-outline',
      iconColor: ICON_COLOR,
      onPress: () => { setBudgetInput((monthlyBudget || '').toString()); setBudgetModalVisible(true); },
    },
  ];

  if (user) {
    TOOL_ITEMS.push(
      {
        id: 'kite-connect',
        label: kiteConnected ? 'Kite Connected' : 'Connect Kite',
        icon: kiteConnected ? 'checkmark-circle-outline' : 'link-outline',
        iconColor: ICON_COLOR,
        onPress: handleConnectKite,
      },
      {
        id: 'kite-sync',
        label:
          kiteSyncing ? 'Syncing...' :
          kiteSyncResult && !kiteSyncResult.includes('failed') ? kiteSyncResult : 'Sync Kite',
        icon: 'sync-outline',
        iconColor: kiteSyncResult && !kiteSyncResult.includes('failed') ? colors.success : ICON_COLOR,
        spinner: kiteSyncing,
        disabled: kiteSyncing,
        onPress: handleKiteSync,
      }
    );
    if (kiteConnected) {
      TOOL_ITEMS.push({
        id: 'kite-disconnect',
        label: 'Disconnect Kite',
        icon: 'unlink-outline',
        iconColor: colors.error,
        onPress: handleDisconnectKite,
      });
    }
  }

  const modalScale = modalAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const modalOpacity = modalAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Grid Sections */}
        {GRID_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionLabel}>{section.title}</Text>
            <View style={styles.grid}>
              {section.items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.gridItem}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.gridCircle}>
                    <Ionicons name={item.icon as any} size={28} color={ICON_COLOR} />
                  </View>
                  <Text style={styles.gridLabel} numberOfLines={2}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Tools Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TOOLS</Text>
          <View style={styles.grid}>
            {TOOL_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.gridItem}
                onPress={item.onPress}
                activeOpacity={0.7}
                disabled={item.disabled}
              >
                <View style={styles.gridCircle}>
                  {item.spinner ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <Ionicons name={item.icon as any} size={28} color={item.iconColor} />
                  )}
                </View>
                <Text style={styles.gridLabel} numberOfLines={2}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Cloud Sync */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CLOUD SYNC</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <View style={[styles.gridCircle, { borderColor: user ? 'rgba(89,214,199,0.35)' : 'rgba(255,136,125,0.35)' }]}>
                <Ionicons
                  name={user ? 'cloud-done-outline' : 'cloud-offline-outline'}
                  size={28}
                  color={user ? colors.success : colors.error}
                />
              </View>
              <Text style={styles.gridLabel} numberOfLines={2}>
                {user ? 'Cloud Synced' : 'Sign In to Sync'}
              </Text>
            </View>

            {user ? (
              <TouchableOpacity
                style={styles.gridItem}
                onPress={handleSyncNow}
                disabled={syncing}
                activeOpacity={0.7}
              >
                <View style={styles.gridCircle}>
                  {syncing ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <Ionicons
                      name="sync-outline"
                      size={28}
                      color={syncStatus.lastError ? colors.error : ICON_COLOR}
                    />
                  )}
                </View>
                <Text style={styles.gridLabel} numberOfLines={2}>
                  {syncing ? 'Syncing...' : syncResultMsg || 'Sync Now'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.gridItem}
                onPress={() => setShowAuth(!showAuth)}
                activeOpacity={0.7}
              >
                <View style={styles.gridCircle}>
                  <Ionicons name="log-in-outline" size={28} color={ICON_COLOR} />
                </View>
                <Text style={styles.gridLabel} numberOfLines={2}>Sign In</Text>
              </TouchableOpacity>
            )}

            {user && (
              <TouchableOpacity
                style={styles.gridItem}
                onPress={() => {
                  Alert.alert(
                    'Logout',
                    'Are you sure you want to sign out? Your local data will remain on device.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Logout', style: 'destructive', onPress: () => signOut() },
                    ]
                  );
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.gridCircle, { borderColor: 'rgba(255,136,125,0.35)' }]}>
                  <Ionicons name="power-outline" size={28} color={colors.error} />
                </View>
                <Text style={[styles.gridLabel, { color: colors.error }]}>Logout</Text>
              </TouchableOpacity>
            )}
          </View>

          {user && (
            <SyncStatusCard
              phase={syncPhase}
              queueCount={syncStatus.queueCount}
              lastError={syncStatus.lastError}
              lastAttemptAt={syncStatus.lastAttemptAt}
              lastSyncedAt={lastSyncedAt}
              syncing={syncing}
              onSyncNow={handleSyncNow}
            />
          )}

          {showAuth && !user && (
            <View style={styles.authCard}>
              <TextInput
                style={styles.authInput}
                placeholder="Email"
                placeholderTextColor={colors.outline}
                value={emailInput}
                onChangeText={setEmailInput}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.authInput}
                placeholder="Password"
                placeholderTextColor={colors.outline}
                value={passwordInput}
                onChangeText={setPasswordInput}
                secureTextEntry
              />
              <TouchableOpacity
                style={styles.authButton}
                onPress={async () => {
                  const { error } = await signIn(emailInput, passwordInput);
                  if (error) alert(error);
                  else setShowAuth(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.authButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Budget Modal */}
      <Modal visible={budgetModalVisible} transparent animationType="none" onRequestClose={() => setBudgetModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalCard, { opacity: modalOpacity, transform: [{ scale: modalScale }] }]}>
            <Text style={styles.modalTitle}>Monthly Budget</Text>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>BUDGET (₹)</Text>
              <TextInput style={styles.inp} value={budgetInput} onChangeText={setBudgetInput} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.outline} autoFocus />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setBudgetModalVisible(false)}>
                <Text style={styles.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={() => { const v = parseFloat(budgetInput); setMonthlyBudget(isNaN(v) ? 0 : Math.max(0, Math.round(v)), user?.id); setBudgetModalVisible(false); }}>
                <Text style={styles.modalSaveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.onSurface,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    paddingBottom: 130,
    gap: 12,
  },
  section: {
    marginTop: 16,
    gap: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 20,
  },
  gridCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridLabel: {
    fontSize: 14,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '400',
  },
  authCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: rounded.lg,
    padding: 16,
    gap: 10,
  },
  authInput: {
    backgroundColor: colors.surface,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    height: 44,
    paddingHorizontal: 12,
    color: colors.onSurface,
    fontSize: 14,
  },
  authButton: {
    backgroundColor: colors.primaryContainer,
    borderRadius: rounded.DEFAULT,
    paddingVertical: 12,
    alignItems: 'center',
  },
  authButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    marginTop: -4,
    backgroundColor: `${colors.primary}12`,
    borderRadius: rounded.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.primary}20`,
  },
  syncNowText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: rounded.lg, padding: 24, gap: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
  inpGrp: { gap: 6 },
  inpLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.6 },
  inp: { backgroundColor: colors.surface, borderRadius: rounded.DEFAULT, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, height: 44, paddingHorizontal: 12, color: colors.onSurface, fontSize: 14, fontWeight: '500' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: rounded.DEFAULT, alignItems: 'center' },
  modalCancelTxt: { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },
  modalSave: { flex: 1, paddingVertical: 12, borderRadius: rounded.DEFAULT, backgroundColor: colors.primaryContainer, alignItems: 'center' },
  modalSaveTxt: { fontSize: 14, color: colors.onSurface, fontWeight: '700' },
  syncError: {
    fontSize: 11,
    color: colors.error,
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  pendingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
    borderRadius: rounded.DEFAULT,
    backgroundColor: `${colors.warning}12`,
    alignSelf: 'center',
  },
  pendingText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
  },
});