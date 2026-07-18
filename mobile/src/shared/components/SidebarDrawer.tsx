import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, rounded } from '../theme/spacing';
import { useFinanceStore, getMinBalanceForAccount } from '../../modules/finance/store';
import { triggerBackupNow } from '../../services/backupScheduler';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.78;

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  navigation: any;
}

export default function SidebarDrawer({ isOpen, onClose, navigation }: SidebarDrawerProps) {
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const {
    onboardingName,
    updateOnboardingName,
    accounts,
    fixedExpenses,
    cards,
    receivables,
  } = useFinanceStore();

  // Calculations — match FinanceHomeScreen formula exactly
  const displayName = onboardingName || 'Meridian User';
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.amount, 0);
  const totalLent = receivables.filter((r) => r.type === 'lent').reduce((sum, r) => sum + r.amount, 0);
  const totalBorrowed = receivables.filter((r) => r.type === 'borrowed').reduce((sum, r) => sum + r.amount, 0);
  
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const unpaidFixedExpensesTotal = fixedExpenses
    .filter((f) => f.lastPaidMonth !== currentMonthStr)
    .reduce((sum, f) => sum + f.amount, 0);
  const totalCardBills = cards.reduce((sum, c) => sum + c.balance, 0);
  const deficitsSum = accounts.reduce((sum, acc) => {
    const min = getMinBalanceForAccount(acc.title);
    return sum + (acc.amount < min ? min - acc.amount : 0);
  }, 0);
  
  const totalNetWorth = totalBalance + totalLent - totalBorrowed - unpaidFixedExpensesTotal - totalCardBills - deficitsSum;

  // Name edit state
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState(onboardingName);

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed.length > 0) {
      updateOnboardingName(trimmed);
    }
    setNameModalOpen(false);
  };

  // Backup state
  const [backupStatus, setBackupStatus] = useState<'idle' | 'backing_up' | 'done' | 'error'>('idle');

  const handleBackup = async () => {
    setBackupStatus('backing_up');
    try {
      await triggerBackupNow();
      setBackupStatus('done');
      setTimeout(() => setBackupStatus('idle'), 3000);
    } catch {
      setBackupStatus('error');
      setTimeout(() => setBackupStatus('idle'), 3000);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Slide in and fade overlay
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.6,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide out and fade overlay out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  const handleNavigate = (tabName: string) => {
    onClose();
    navigation.navigate(tabName);
  };

  if (!isOpen) return null;

  return (
    <Modal transparent visible={isOpen} animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Transparent Overlay Background */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        {/* Sidebar Left Sliding Panel */}
        <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
          {/* User Profile Header */}
          <TouchableOpacity style={styles.profileSection} onPress={() => { setNameInput(onboardingName); setNameModalOpen(true); }} activeOpacity={0.7}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color="#ffffff" />
            </View>
            <View style={styles.profileTextWrapper}>
              <Text style={styles.greeting}>Hello,</Text>
              <Text style={styles.username} numberOfLines={1}>{displayName}</Text>
            </View>
            <Ionicons name="pencil" size={14} color="#9a8fb5" />
          </TouchableOpacity>

          {/* Net Worth Overview Widget */}
          <View style={styles.netWorthWidget}>
            <Text style={styles.netWorthLabel}>Total Net Worth</Text>
            <Text style={styles.netWorthValue}>
              ₹{(totalNetWorth / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </Text>
          </View>

          {/* Nav Menu List */}
          <View style={styles.navMenu}>
            <Text style={styles.sectionTitle}>QUICK NAVIGATION</Text>
            
            <TouchableOpacity style={styles.navItem} onPress={() => handleNavigate('FinanceTab')}>
              <Ionicons name="wallet-outline" size={20} color={colors.primary} />
              <Text style={styles.navText}>Finance Tracker</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => handleNavigate('GarageTab')}>
              <Ionicons name="car-outline" size={20} color={colors.primary} />
              <Text style={styles.navText}>Garage (Jupiter 125)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => handleNavigate('TasksTab')}>
              <Ionicons name="checkbox-outline" size={20} color={colors.primary} />
              <Text style={styles.navText}>Task Manager</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => handleNavigate('InvestmentsTab')}>
              <Ionicons name="trending-up-outline" size={20} color={colors.primary} />
              <Text style={styles.navText}>Kite Holdings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => handleNavigate('MoreTab')}>
              <Ionicons name="ellipsis-horizontal-outline" size={20} color={colors.primary} />
              <Text style={styles.navText}>Notes & Recipes</Text>
            </TouchableOpacity>
          </View>

          {/* Backup Section */}
          <View style={styles.backupSection}>
            <TouchableOpacity
              style={[styles.backupBtn, backupStatus === 'backing_up' && { opacity: 0.6 }]}
              onPress={handleBackup}
              disabled={backupStatus === 'backing_up'}
              activeOpacity={0.8}
            >
              {backupStatus === 'backing_up' ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : backupStatus === 'done' ? (
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              ) : backupStatus === 'error' ? (
                <Ionicons name="alert-circle" size={18} color="#ef4444" />
              ) : (
                <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
              )}
              <Text style={styles.backupBtnText}>
                {backupStatus === 'backing_up' ? 'Backing up...' : backupStatus === 'done' ? 'Backup saved' : backupStatus === 'error' ? 'Backup failed' : 'Backup Now'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.drawerFooter}>
            <Text style={styles.versionText}>Meridian Tracker v1.0.0</Text>
          </View>
        </Animated.View>
      </View>

      {/* Name Edit Modal */}
      <Modal transparent visible={nameModalOpen} animationType="fade" onRequestClose={() => setNameModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Name</Text>
            <TextInput
              style={styles.modalInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setNameModalOpen(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnAdd]} onPress={handleSaveName}>
                <Text style={styles.modalBtnAddText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  drawer: {
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#15121b', // Obsidian background matching onboarding
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 64,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTextWrapper: {
    flex: 1,
  },
  greeting: {
    fontSize: 12,
    color: '#ccc3d8',
    opacity: 0.8,
  },
  username: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  netWorthWidget: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 16,
    padding: 16,
    borderColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    marginBottom: 24,
  },
  netWorthLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#baabf3',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  netWorthValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  navMenu: {
    gap: 8,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ccc3d8',
    opacity: 0.6,
    letterSpacing: 1,
    marginBottom: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    gap: 12,
    borderRadius: 8,
  },
  navText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e8dfee',
  },
  payzappTracker: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    marginBottom: 24,
  },
  payzappHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  payzappTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payzappTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e8dfee',
  },
  loadAddBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payzappMetrics: {
    marginBottom: 10,
  },
  payzappMetricVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  payzappMetricMax: {
    fontSize: 13,
    color: '#ccc3d8',
    fontWeight: '400',
  },
  payzappSub: {
    fontSize: 11,
    color: '#ccc3d8',
    opacity: 0.6,
    marginTop: 2,
  },
  progressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 3,
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 16,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 10,
    color: '#ccc3d8',
    opacity: 0.4,
  },
  backupSection: {
    paddingBottom: 8,
  },
  backupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
  },
  backupBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e8dfee',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 16,
    padding: 24,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  modalInput: {
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.onSurface,
    borderColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalBtnCancelText: {
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  modalBtnAdd: {
    backgroundColor: colors.primary,
  },
  modalBtnAddText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
