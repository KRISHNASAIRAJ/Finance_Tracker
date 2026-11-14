/**
 * MoreMenuScreen — Settings hub with backup, sync, notifications, and module shortcuts.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { mc, mr } from '../../../shared/theme/meridian';
import { Label, Screen } from '../../../shared/components/meridian';
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


import SyncStatusCard from '../../../shared/components/SyncStatusCard';

type NavigationProp = NativeStackNavigationProp<MoreStackParamList, 'MoreMenu'>;

/** Semantic tint per section (sky = utilities, amber = growth, mint = health, violet = tools, red = account). */
const SECTION_TINTS: Record<string, { icon: string; bg: string }> = {
  UTILITIES: { icon: mc.sky, bg: mc.skyDim },
  'GOALS & GROWTH': { icon: mc.amber, bg: mc.amberDim },
  HEALTH: { icon: mc.mint, bg: mc.mintDim },
  TOOLS: { icon: mc.violet, bg: mc.violetDim },
  ACCOUNT: { icon: mc.redSoft, bg: mc.redDim },
};

export default function MoreMenuScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, signIn, signOut } = useAuth();
  const { pullFromCloud: pullPersonal } = usePersonalSync();
  const { pullFromCloud: pullEquity } = useEquitySync();
  const { pullFromCloud: pullTasks } = useTasksSync();
  const modalAnim = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      entrance.setValue(0);
      Animated.timing(entrance, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      pullPersonal();
      pullEquity();
      pullTasks();
      processSyncQueue().catch((e: Error) => console.warn('[MoreMenu] syncQueue flush failed:', e));
    }, [pullPersonal, pullEquity, pullTasks, entrance])
  );
  const [backupState, setBackupState] = useState<'idle' | 'backing' | 'done' | 'error'>('idle');
  const [showAuth, setShowAuth] = useState(false);
  const [kiteSyncing, setKiteSyncing] = useState(false);
  const [kiteSyncResult, setKiteSyncResult] = useState<string | null>(null);
  const [kiteConnected, setKiteConnected] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [, setSyncResultMsg] = useState<string | null>(null);

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
        {
          id: 'buylist',
          label: 'Buy List',
          icon: 'cart-outline',
          onPress: () => navigation.navigate('BuyList'),
        },
        {
          id: 'grocerylist',
          label: 'Grocery List',
          icon: 'basket-outline',
          onPress: () => navigation.navigate('GroceryList'),
        },
        {
          id: 'offers',
          label: 'Offers',
          icon: 'pricetags-outline',
          onPress: () => navigation.navigate('Offers'),
        },
        {
          id: 'pill-reminder',
          label: 'Pill Reminder',
          icon: 'medkit-outline',
          onPress: () => navigation.navigate('PillReminder'),
        },
        {
          id: 'people',
          label: 'Keep in Touch',
          icon: 'people-outline',
          onPress: () => navigation.navigate('People'),
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
        {
          id: 'careergoals',
          label: 'Career Goals',
          icon: 'flag-outline',
          onPress: () => navigation.navigate('CareerGoals'),
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
          id: 'mealplanner',
          label: 'Meal Planner',
          icon: 'calendar-outline',
          onPress: () => navigation.navigate('MealPlanner'),
        },
        {
          id: 'weight',
          label: 'Weight Tracker',
          icon: 'scale-outline',
          onPress: () => navigation.navigate('WeightTracker'),
        },
        {
          id: 'sleep',
          label: 'Sleep Tracker',
          icon: 'moon-outline',
          onPress: () => navigation.navigate('SleepTracker'),
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
      onPress: () => (navigation as any).navigate('MainTabs', { screen: 'FinanceTab', params: { screen: 'CardChat' } }),
    },
    {
      id: 'report',
      label: 'Monthly Report',
      icon: 'document-text-outline',
      onPress: handleMonthlyReport,
    },
    {
      id: 'combined-report',
      label: 'Combined Report',
      icon: 'bar-chart-outline',
      onPress: () => navigation.navigate('CombinedReport'),
    },
    {
      id: 'daily-report',
      label: 'Daily Report',
      icon: 'newspaper-outline',
      onPress: () => navigation.navigate('DailyReport'),
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
        backupState === 'done' ? mc.mint :
        backupState === 'error' ? mc.redSoft : undefined,
      spinner: backupState === 'backing',
      disabled: backupState === 'backing',
      onPress: handleBackupNow,
    },
    {
      id: 'budget',
      label: 'Monthly Budget',
      icon: 'wallet-outline',
      onPress: () => { setBudgetInput((monthlyBudget || '').toString()); setBudgetModalVisible(true); },
    },
  ];

  if (user) {
    TOOL_ITEMS.push(
      {
        id: 'kite-connect',
        label: kiteConnected ? 'Kite Connected' : 'Connect Kite',
        icon: kiteConnected ? 'checkmark-circle-outline' : 'link-outline',
          onPress: handleConnectKite,
      },
      {
        id: 'kite-sync',
        label:
          kiteSyncing ? 'Syncing...' :
          kiteSyncResult && !kiteSyncResult.includes('failed') ? kiteSyncResult : 'Sync Kite',
        icon: 'sync-outline',
        iconColor: kiteSyncResult && !kiteSyncResult.includes('failed') ? mc.mint : undefined,
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
        iconColor: mc.redSoft,
        onPress: handleDisconnectKite,
      });
    }
  }

  const modalScale = modalAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const modalOpacity = modalAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  // Staggered section entrance on focus (including back navigation)
  const sectionAnim = (i: number) => ({
    opacity: entrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [{
      translateY: entrance.interpolate({
        inputRange: [0, 1],
        outputRange: [24 + i * 10, 0],
      }),
    }],
  });

  return (
    <>
    <Screen scroll bottomInset={40} contentStyle={styles.scrollContent}>
        {/* Grid Sections */}
        {GRID_SECTIONS.map((section, si) => {
          const tint = SECTION_TINTS[section.title] ?? SECTION_TINTS.TOOLS;
          return (
            <Animated.View key={section.title} style={sectionAnim(si)}>
              <View style={styles.section}>
                <Label style={styles.sectionLabel}>{section.title}</Label>
                <View style={styles.grid}>
                  {section.items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.gridItem}
                      onPress={item.onPress}
                      activeOpacity={0.7}
                      accessibilityLabel={item.label}
                    >
                      <View style={[styles.gridCircle, { backgroundColor: tint.bg }]}>
                        <Ionicons name={item.icon as any} size={24} color={tint.icon} />
                      </View>
                      <Text style={styles.gridLabel} numberOfLines={2}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Animated.View>
          );
        })}

        {/* Tools Section */}
        <Animated.View style={sectionAnim(GRID_SECTIONS.length)}>
          <View style={styles.section}>
            <Label style={styles.sectionLabel}>TOOLS</Label>
            <View style={styles.grid}>
              {TOOL_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.gridItem}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                  disabled={item.disabled}
                  accessibilityLabel={item.label}
                >
                  <View style={[styles.gridCircle, { backgroundColor: SECTION_TINTS.TOOLS.bg }]}>
                    {item.spinner ? (
                      <ActivityIndicator color={SECTION_TINTS.TOOLS.icon} size="small" />
                    ) : (
                      <Ionicons name={item.icon as any} size={24} color={item.iconColor ?? SECTION_TINTS.TOOLS.icon} />
                    )}
                  </View>
                  <Text style={styles.gridLabel} numberOfLines={2}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Cloud Sync */}
        <Animated.View style={sectionAnim(GRID_SECTIONS.length + 1)}>
          <View style={styles.section}>
            <Label style={styles.sectionLabel}>ACCOUNT</Label>
            {!user ? (
              <View style={styles.grid}>
                <TouchableOpacity
                  style={styles.gridItem}
                  onPress={() => setShowAuth(!showAuth)}
                  activeOpacity={0.7}
                  accessibilityLabel="Sign in"
                >
                  <View style={[styles.gridCircle, { backgroundColor: mc.skyDim }]}>
                    <Ionicons name="log-in-outline" size={24} color={mc.sky} />
                  </View>
                  <Text style={styles.gridLabel} numberOfLines={2}>Sign In</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.grid}>
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
                  accessibilityLabel="Logout"
                >
                  <View style={[styles.gridCircle, { backgroundColor: SECTION_TINTS.ACCOUNT.bg }]}>
                    <Ionicons name="power-outline" size={24} color={SECTION_TINTS.ACCOUNT.icon} />
                  </View>
                  <Text style={[styles.gridLabel, { color: mc.redSoft }]}>Logout</Text>
                </TouchableOpacity>
              </View>
            )}

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
                  placeholderTextColor={mc.textGhost}
                  value={emailInput}
                  onChangeText={setEmailInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.authInput}
                  placeholder="Password"
                  placeholderTextColor={mc.textGhost}
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
        </Animated.View>
    </Screen>

      {/* Budget Modal */}
      <Modal visible={budgetModalVisible} transparent animationType="none" onRequestClose={() => setBudgetModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalCard, { opacity: modalOpacity, transform: [{ scale: modalScale }] }]}>
            <Text style={styles.modalTitle}>Monthly Budget</Text>
            <View style={styles.inpGrp}>
              <Text style={styles.inpLabel}>BUDGET (₹)</Text>
              <TextInput style={styles.inp} value={budgetInput} onChangeText={setBudgetInput} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={mc.textGhost} autoFocus />
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
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: 4,
  },
  section: {
    marginTop: 12,
    gap: 10,
  },
  sectionLabel: {
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 18,
    gap: 7,
  },
  gridCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    fontSize: 11,
    lineHeight: 15,
    color: mc.text,
    textAlign: 'center',
  },
  authCard: {
    backgroundColor: mc.card,
    borderRadius: mr.row,
    padding: 16,
    gap: 10,
  },
  authInput: {
    backgroundColor: mc.raised,
    borderRadius: 18,
    height: 44,
    paddingHorizontal: 14,
    color: mc.text,
    fontSize: 14,
  },
  authButton: {
    backgroundColor: mc.red,
    borderRadius: 22,
    paddingVertical: 12,
    alignItems: 'center',
  },
  authButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: mc.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: mc.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: mc.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
    elevation: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: mc.text,
  },
  inpGrp: { gap: 6 },
  inpLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: mc.textDim,
    letterSpacing: 1,
    paddingHorizontal: 4,
  },
  inp: {
    backgroundColor: mc.raised,
    borderRadius: 18,
    height: 48,
    paddingHorizontal: 14,
    color: mc.text,
    fontSize: 15,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 22,
    backgroundColor: mc.raised,
    alignItems: 'center',
  },
  modalCancelTxt: {
    fontSize: 14,
    color: mc.textDim,
  },
  modalSave: {
    flex: 1.4,
    paddingVertical: 13,
    borderRadius: 22,
    backgroundColor: mc.red,
    alignItems: 'center',
  },
  modalSaveTxt: {
    fontSize: 16,
    color: mc.white,
    fontWeight: '500',
  },
});