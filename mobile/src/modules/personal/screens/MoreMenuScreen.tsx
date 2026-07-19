import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore } from '../../finance/store';
import { usePersonalStore } from '../store';
import { useInvestmentsStore } from '../../equity/store';
import { triggerBackupNow } from '../../../services/backupScheduler';
import { MoreStackParamList } from '../../../navigation/RootNavigator';
import { useAuth } from '../../../services/AuthProvider';
import { syncNow } from '../../finance/hooks/useFinanceSync';
import { usePersonalSync, syncPersonalNow } from '../hooks/usePersonalSync';
import { useEquitySync, syncEquityNow } from '../../equity/hooks/useEquitySync';
import { scanExistingSms } from '../../../services/smsHandler';
import { supabase } from '../../../services/supabaseClient';

type NavigationProp = NativeStackNavigationProp<MoreStackParamList, 'MoreMenu'>;

export default function MoreMenuScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, signIn, signOut } = useAuth();
  usePersonalSync();
  useEquitySync();
  const notifications = useFinanceStore((state) => state.notifications);
  const lastSyncedAt = useFinanceStore((state) => state.lastSyncedAt);
  const lastPersonalSync = usePersonalStore((state) => state.lastPersonalSyncedAt);
  const lastEquitySync = useInvestmentsStore((state) => state.lastEquitySyncedAt);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const [backupState, setBackupState] = useState<'idle' | 'backing' | 'done' | 'error'>('idle');
  const [showAuth, setShowAuth] = useState(false);
  const [scanningSms, setScanningSms] = useState(false);
  const [smsScanResult, setSmsScanResult] = useState<string | null>(null);
  const [kiteSyncing, setKiteSyncing] = useState(false);
  const [kiteSyncResult, setKiteSyncResult] = useState<string | null>(null);
  const [kiteConnected, setKiteConnected] = useState(false);
  const [kiteLastSynced, setKiteLastSynced] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [syncing, setSyncing] = useState(false);

  const handleSyncNow = async () => {
    if (!user || syncing) return;
    setSyncing(true);
    await syncNow(user.id);
    await syncPersonalNow(user.id);
    await syncEquityNow(user.id);
    setSyncing(false);
  };

  const timeAgo = (isoStr: string | null): string => {
    if (!isoStr) return 'Never';
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
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

  const NAV_ITEMS = [
    {
      id: 'finance',
      title: 'Finance Tracker',
      subtitle: 'Expenses, cards & accounts',
      icon: 'wallet-outline',
      color: colors.primary,
      onPress: () => navigation.getParent()?.navigate('FinanceTab'),
    },
    {
      id: 'garage',
      title: 'Garage',
      subtitle: 'Fuel logs & vehicle spend',
      icon: 'speedometer-outline',
      color: '#10b981',
      onPress: () => navigation.getParent()?.navigate('GarageTab'),
    },
    {
      id: 'tasks',
      title: 'Task Manager',
      subtitle: 'Tasks, reminders & subtasks',
      icon: 'checkbox-outline',
      color: '#f59e0b',
      onPress: () => navigation.getParent()?.navigate('TasksTab'),
    },
    {
      id: 'investments',
      title: 'Kite Holdings',
      subtitle: 'Portfolio & equity tracker',
      icon: 'trending-up-outline',
      color: '#3b82f6',
      onPress: () => navigation.getParent()?.navigate('InvestmentsTab'),
    },
    {
      id: 'notifications',
      title: 'Notifications',
      subtitle: unreadCount > 0 ? `${unreadCount} unread` : 'All caught up',
      icon: 'notifications-outline',
      color: '#ef4444',
      badge: unreadCount,
      onPress: () => (navigation as any).navigate('Notifications'),
    },
  ];

  const MENU_ITEMS = [
    {
      id: 'reports',
      title: 'Combined Report',
      subtitle: 'Net worth, allocation & spend overview',
      icon: 'bar-chart-outline',
      color: '#8b5cf6',
      route: 'CombinedReport' as const,
    },
    {
      id: 'notes',
      title: 'Personal Notes',
      subtitle: 'Markdown logs, drafts & records',
      icon: 'document-text-outline',
      color: colors.primary,
      route: 'PersonalNotes' as const,
    },
    {
      id: 'goals',
      title: '2026 Goals Tracker',
      subtitle: 'Core life milestones & objectives',
      icon: 'ribbon-outline',
      color: colors.success,
      route: 'GoalsTracker' as const,
    },
    {
      id: 'recipes',
      title: 'Recipes Library',
      subtitle: 'High-protein diet card sheets',
      icon: 'restaurant-outline',
      color: colors.tertiary,
      route: 'RecipesLibrary' as const,
    },
    {
      id: 'diet',
      title: 'Diet Plan Tracker',
      subtitle: 'Weekly calorie and meal mapping',
      icon: 'nutrition-outline',
      color: '#f59e0b',
      route: 'DietPlanTracker' as const,
    },
  ];

  const handleConnectKite = () => {
    const apiKey = process.env.EXPO_PUBLIC_KITE_API_KEY;
    console.log('[KiteConnect] apiKey:', apiKey ? apiKey.substring(0, 5) + '...' : 'EMPTY');
    if (!apiKey || apiKey === 'YOUR_KITE_API_KEY_HERE') {
      setKiteSyncResult('Set KITE_API_KEY in .env first');
      setTimeout(() => setKiteSyncResult(null), 3000);
      return;
    }
    const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}`;
    Linking.openURL(loginUrl);
  };

  const handleKiteSync = async () => {
    if (!user || kiteSyncing) return;
    setKiteSyncing(true);
    setKiteSyncResult(null);
    try {
      const res = await fetch(
        'https://rkmouoglorsnijmemmcd.supabase.co/functions/v1/kite-holdings-sync',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(supabase as any).supabaseKey}`,
          },
          body: JSON.stringify({ user_id: user.id }),
        }
      );
      const data = await res.json();
      if (data.error) {
        setKiteSyncResult(data.error);
      } else if (!res.ok) {
        setKiteSyncResult('Server error');
      } else {
        setKiteSyncResult(`${data.synced} equity + ${data.mfSynced} MF synced`);
        setKiteConnected(true);
        setKiteLastSynced(new Date().toISOString());
        await syncEquityNow(user.id);
      }
    } catch (e: any) {
      setKiteSyncResult(e.message || 'Sync failed');
    } finally {
      setKiteSyncing(false);
      setTimeout(() => setKiteSyncResult(null), 3000);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with bell */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hub</Text>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => (navigation as any).navigate('Notifications')}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.onSurface} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Quick Navigation */}
        <Text style={styles.sectionTitle}>QUICK NAVIGATION</Text>
        <View style={styles.navGrid}>
          {NAV_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.navCard}
              onPress={item.onPress}
              activeOpacity={0.8}
            >
              <View style={[styles.navIconWrap, { backgroundColor: `${item.color}18` }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <View style={styles.navDetails}>
                <Text style={styles.navTitle}>{item.title}</Text>
                <Text style={styles.navSubtitle}>{item.subtitle}</Text>
              </View>
              {item.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={colors.outline} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Content Section */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>CONTENT</Text>
        <View style={styles.menuGrid}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuCard}
              onPress={() => navigation.navigate(item.route)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrapper, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={24} color={item.color} />
              </View>
              <View style={styles.cardDetails}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.outline} style={styles.arrow} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Tools Section */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>TOOLS</Text>
        <TouchableOpacity
          style={styles.menuCard}
          onPress={handleBackupNow}
          activeOpacity={0.8}
          disabled={backupState === 'backing'}
        >
          <View style={[styles.iconWrapper, { backgroundColor: 'rgba(124, 58, 237, 0.12)' }]}>
            {backupState === 'backing' ? (
              <ActivityIndicator color="#7c3aed" size="small" />
            ) : (
              <Ionicons
                name={backupState === 'done' ? 'checkmark-circle' : backupState === 'error' ? 'alert-circle' : 'cloud-upload-outline'}
                size={24}
                color={backupState === 'done' ? '#10b981' : backupState === 'error' ? '#ef4444' : '#7c3aed'}
              />
            )}
          </View>
          <View style={styles.cardDetails}>
            <Text style={styles.cardTitle}>Backup Now</Text>
            <Text style={styles.cardSubtitle}>
              {backupState === 'backing' ? 'Saving backup...' : backupState === 'done' ? 'Backup saved!' : backupState === 'error' ? 'Backup failed' : 'Export all data to file'}
            </Text>
          </View>
        </TouchableOpacity>

        {user && (
          <>
            <TouchableOpacity
              style={styles.menuCard}
              onPress={handleConnectKite}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrapper, { backgroundColor: kiteConnected ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                <Ionicons name={kiteConnected ? 'checkmark-circle-outline' : 'link-outline'} size={24} color={kiteConnected ? '#10b981' : '#ef4444'} />
              </View>
              <View style={styles.cardDetails}>
                <Text style={styles.cardTitle}>
                  {kiteConnected ? 'Kite Connected' : 'Connect Kite'}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {kiteConnected ? 'Zerodha account linked' : 'Re-authenticate with Zerodha Kite'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.outline} style={styles.arrow} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuCard}
              onPress={handleKiteSync}
              activeOpacity={0.8}
              disabled={kiteSyncing}
            >
              <View style={[styles.iconWrapper, { backgroundColor: kiteConnected ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)' }]}>
                {kiteSyncing ? (
                  <ActivityIndicator color="#3b82f6" size="small" />
                ) : (
                  <Ionicons
                    name={kiteSyncResult && !kiteSyncResult.includes('failed') ? 'checkmark-circle' : 'sync-outline'}
                    size={24}
                    color={kiteSyncResult && !kiteSyncResult.includes('failed') ? '#10b981' : '#3b82f6'}
                  />
                )}
              </View>
              <View style={styles.cardDetails}>
                <Text style={styles.cardTitle}>
                  {kiteSyncing ? 'Syncing...' : kiteSyncResult || 'Sync Zerodha Kite'}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {kiteLastSynced ? `Last synced ${timeAgo(kiteLastSynced)}` : 'Pull equity & mutual fund holdings from Kite'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.outline} style={styles.arrow} />
            </TouchableOpacity>
          </>
        )}

        {/* Cloud Sync */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>CLOUD SYNC</Text>
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => user ? signOut() : setShowAuth(!showAuth)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconWrapper, { backgroundColor: user ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
            <Ionicons
              name={user ? 'cloud-done-outline' : 'cloud-offline-outline'}
              size={24}
              color={user ? '#10b981' : '#ef4444'}
            />
          </View>
          <View style={styles.cardDetails}>
            <Text style={styles.cardTitle}>{user ? 'Cloud Synced' : 'Sign In to Sync'}</Text>
            <Text style={styles.cardSubtitle}>
              {user
                ? `Signed in as ${user.email} · Fin: ${timeAgo(lastSyncedAt)} · Eq: ${timeAgo(lastEquitySync)} · Notes: ${timeAgo(lastPersonalSync)}`
                : 'Sync expenses, cards, and data across devices'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.outline} style={styles.arrow} />
        </TouchableOpacity>

        {user && (
          <TouchableOpacity
            style={styles.syncNowBtn}
            onPress={handleSyncNow}
            disabled={syncing}
            activeOpacity={0.8}
          >
            <Ionicons
              name={syncing ? 'sync-outline' : 'sync-outline'}
              size={16}
              color={colors.primary}
            />
            <Text style={styles.syncNowText}>
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Text>
          </TouchableOpacity>
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

        {/* SMS Scanner */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>SMS EXPENSE DETECTION</Text>
        <TouchableOpacity
          style={styles.menuCard}
          onPress={async () => {
            setScanningSms(true);
            setSmsScanResult(null);
            const count = await scanExistingSms();
            setScanningSms(false);
            setSmsScanResult(count > 0 ? `Found ${count} transactions` : 'No transactions found');
            if (count > 0) {
              setTimeout(() => setSmsScanResult(null), 3000);
            }
          }}
          activeOpacity={0.8}
          disabled={scanningSms}
        >
          <View style={[styles.iconWrapper, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#3b82f6" />
          </View>
          <View style={styles.cardDetails}>
            <Text style={styles.cardTitle}>
              {scanningSms ? 'Scanning SMS...' : smsScanResult || 'Scan Bank SMS'}
            </Text>
            <Text style={styles.cardSubtitle}>
              Auto-detect expenses from HDFC, ICICI, SBI, Axis & more
            </Text>
          </View>
          {scanningSms ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.outline} style={styles.arrow} />
          )}
        </TouchableOpacity>

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.containerPadding,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onSurface,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  scrollContent: {
    padding: spacing.containerPadding,
    paddingBottom: 40,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 8,
  },
  navGrid: {
    gap: 10,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 14,
    gap: 14,
  },
  navIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDetails: {
    flex: 1,
    gap: 2,
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  navSubtitle: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  menuGrid: {
    gap: 12,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: rounded.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardDetails: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  arrow: {
    marginLeft: 8,
  },
  authCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: 16,
    gap: 10,
  },
  authInput: {
    backgroundColor: colors.surface,
    borderRadius: rounded.DEFAULT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    color: '#ffffff',
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
    borderWidth: 1,
    borderColor: `${colors.primary}20`,
  },
  syncNowText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
