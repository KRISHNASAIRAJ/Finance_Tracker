/**
 * DrawerMenu — global slide-in sidebar.
 *
 * Core Animated only (no reanimated/gesture-handler deps):
 *  - springs open from the left with a fading backdrop
 *  - left-edge swipe to open, drawer swipe/backdrop/back-button to close
 *  - staggered row entrance driven by the same progress value
 *  - active route highlight so you always know where you are
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tc } from '../theme/tracend';
import { useDrawerStore } from '../useDrawerStore';
import { useFinanceStore } from '../../modules/finance/store';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../services/AuthProvider';

type RootNav = NativeStackNavigationProp<RootStackParamList>;

const SCREEN_W = Dimensions.get('window').width;
const DRAWER_W = Math.min(300, SCREEN_W * 0.80);

function getActiveRouteName(state: any): string | undefined {
  if (!state) return undefined;
  const route = state.routes?.[state.index ?? 0];
  if (!route) return undefined;
  if (route.state) return getActiveRouteName(route.state);
  return route.name;
}

type Item = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  danger?: boolean;
  grad?: readonly [string, string];
};

const ACTIVE_MAP: Record<string, string> = {
  FinanceTab: 'home',
  FinanceHome: 'home',
  GarageTab: 'garage',
  TasksTab: 'tasks',
  InvestmentsTab: 'wealth',
};

export default function DrawerMenu() {
  const navigation = useNavigation<RootNav>();
  const { isOpen, open, close, toggle } = useDrawerStore();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const isOnboarded = useFinanceStore((state) => state.isOnboarded);

  const [activeRouteName, setActiveRouteName] = useState<string | undefined>(() => {
    try {
      return getActiveRouteName(navigation.getState());
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    const unsub = navigation.addListener('state', () => {
      try {
        setActiveRouteName(getActiveRouteName(navigation.getState()));
      } catch {
        setActiveRouteName(undefined);
      }
    });
    return unsub;
  }, [navigation]);

  const isHomeScreen = activeRouteName === 'FinanceHome';
  const showTrigger = isOnboarded && isHomeScreen;
  const activeId = activeRouteName ? ACTIVE_MAP[activeRouteName] : undefined;

  const progress = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;

  const translateX = Animated.add(
    dragX,
    progress.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_W, 0] })
  );
  const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const rowOpacity = (i: number) =>
    progress.interpolate({ inputRange: [0, 0.18 + i * 0.045, 0.5 + i * 0.045], outputRange: [0, 0, 1] });
  const rowOffset = (i: number) =>
    progress.interpolate({
      inputRange: [0, 0.18 + i * 0.045, 0.5 + i * 0.045],
      outputRange: [-12, -12, 0],
    });

  const openAnim = useCallback(() => {
    dragX.setValue(0);
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      damping: 24,
      stiffness: 200,
      mass: 0.85,
    }).start();
  }, [progress, dragX]);

  const closeAnim = useCallback(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => dragX.setValue(0));
  }, [progress, dragX]);

  useEffect(() => {
    if (isOpen) openAnim();
    else closeAnim();
  }, [isOpen, openAnim, closeAnim]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isOpenRef.current) {
        close();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [close]);

  const snap = useCallback(
    (toOpen: boolean) => {
      if (toOpen) {
        if (!isOpenRef.current) open();
        else openAnim();
      } else {
        if (isOpenRef.current) close();
        else closeAnim();
      }
    },
    [open, close, openAnim, closeAnim]
  );

  const edgeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => !isOpenRef.current && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => {
        if (isOpenRef.current) return;
        progress.setValue(Math.max(0, Math.min(1, g.dx / DRAWER_W)));
      },
      onPanResponderRelease: (_e, g) => {
        if (isOpenRef.current) return;
        if (g.dx > DRAWER_W * 0.28) snap(true);
        else snap(false);
      },
      onPanResponderTerminate: () => {
        if (!isOpenRef.current) snap(false);
      },
    })
  ).current;

  const panelResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dx < 0 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => {
        const p = Math.max(0, Math.min(1, 1 + g.dx / DRAWER_W));
        progress.setValue(p);
        dragX.setValue(0);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -DRAWER_W * 0.28) snap(false);
        else snap(true);
      },
      onPanResponderTerminate: () => snap(true),
    })
  ).current;

  const go = (action: () => void) => {
    close();
    setTimeout(action, 120);
  };

  const signOutWithConfirm = () => {
    close();
    setTimeout(() => signOut(), 120);
  };

  const primaryItems: Item[] = [
    {
      id: 'home', label: 'Home', icon: 'home-outline',
      grad: ['#7b8eff', '#3a4fc9'] as const,
      onPress: () => go(() => navigation.navigate('MainTabs', { screen: 'FinanceTab' })),
    },
    {
      id: 'garage', label: 'Garage', icon: 'bicycle-outline',
      grad: ['#5ee6ff', '#007d8f'] as const,
      onPress: () => go(() => navigation.navigate('MainTabs', { screen: 'GarageTab' })),
    },
    {
      id: 'tasks', label: 'Tasks', icon: 'checkbox-outline',
      grad: ['#ffd9a0', '#e2a45c'] as const,
      onPress: () => go(() => navigation.navigate('MainTabs', { screen: 'TasksTab' })),
    },
    {
      id: 'wealth', label: 'Wealth', icon: 'trending-up-outline',
      grad: ['#4fdbcc', '#007d73'] as const,
      onPress: () => go(() => navigation.navigate('MainTabs', { screen: 'InvestmentsTab' })),
    },
  ];

  const toolItems: Item[] = [
    { id: 'cardchat', label: 'AI Card Chat', icon: 'sparkles-outline', onPress: () => go(() => navigation.navigate('MainTabs', { screen: 'FinanceTab', params: { screen: 'CardChat' } })) },
    { id: 'notes', label: 'Personal Notes', icon: 'document-text-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'PersonalNotes' })) },
    { id: 'diary', label: 'Weekly Diary', icon: 'journal-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'WeeklyDiary' })) },
    { id: 'goals', label: '2026 Goal Tracker', icon: 'ribbon-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'GoalsTracker' })) },
    { id: 'career', label: 'Career Track', icon: 'trending-up-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'CareerTracker' })) },
    { id: 'meals', label: 'Meal Logger', icon: 'restaurant-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'MealLogger' })) },
    { id: 'weight', label: 'Weight Tracker', icon: 'scale-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'WeightTracker' })) },
    { id: 'diet', label: 'Project 65 Diet', icon: 'fitness-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'DietViewer' })) },
    { id: 'recipes', label: 'Recipes Library', icon: 'book-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'RecipesLibrary' })) },
    { id: 'report', label: 'Combined Report', icon: 'bar-chart-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'CombinedReport' })) },
  ];

  const systemItems: Item[] = [
    { id: 'settings', label: 'Settings & Sync', icon: 'settings-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'MoreMenu' })) },
    ...(user
      ? [{ id: 'logout', label: 'Logout', icon: 'power-outline' as const, danger: true, onPress: signOutWithConfirm }]
      : []),
  ];

  const rows = useMemo(() => [
    ...primaryItems.map((it) => ({ ...it, group: 'primary' as const })),
    ...toolItems.map((it) => ({ ...it, group: 'tools' as const })),
    ...systemItems.map((it) => ({ ...it, group: 'system' as const })),
  ], []);

  const indexOf = (id: string) => rows.findIndex((r) => r.id === id);

  const initials = user?.email
    ? user.email.split('@')[0].split(/[._-]/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : 'M';

  const renderRow = (item: Item, i: number) => {
    const isActive = item.id === activeId && !item.danger;
    return (
      <Animated.View
        key={item.id}
        style={{ opacity: rowOpacity(i), transform: [{ translateX: rowOffset(i) }] }}
      >
        <TouchableOpacity
          style={[styles.row, isActive && styles.rowActive]}
          activeOpacity={0.65}
          onPress={item.onPress}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          {isActive && <View style={styles.activeBar} />}
          <View
            style={[
              styles.rowIcon,
              item.grad ? undefined : styles.rowIconPlain,
              item.danger && { backgroundColor: `${tc.attention}18` },
              isActive && !item.grad && styles.rowIconActive,
            ]}
          >
            {item.grad ? (
              <LinearGradient colors={[item.grad[0], item.grad[1]]} style={styles.rowIconGrad}>
                <Ionicons name={item.icon} size={18} color="#ffffff" />
              </LinearGradient>
            ) : (
              <Ionicons
                name={item.icon}
                size={20}
                color={item.danger ? tc.attention : isActive ? tc.action : 'rgba(255,255,255,0.65)'}
              />
            )}
          </View>
          <Text
            style={[
              styles.rowLabel,
              item.danger && { color: tc.attention },
              isActive && styles.rowLabelActive,
            ]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <>
      {showTrigger && <View style={styles.edgeStrip} {...edgeResponder.panHandlers} />}

      {showTrigger && (
        <TouchableOpacity
          style={[styles.trigger, { top: insets.top + 29 }]}
          activeOpacity={0.7}
          onPress={toggle}
        >
          <Ionicons name="menu" size={20} color={tc.textPrimary} />
        </TouchableOpacity>
      )}

      <View
        style={[StyleSheet.absoluteFill, styles.layer]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={close}
          style={StyleSheet.absoluteFill}
        >
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableOpacity>

        <Animated.View style={[styles.panel, { transform: [{ translateX }] }]} {...panelResponder.panHandlers}>
          {/* Premium accent line at the top */}
          <LinearGradient
            colors={['#7b8eff', '#4fdbcc', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topAccent}
          />

          {/* Header */}
          <View style={[styles.panelHeader, { paddingTop: insets.top + 24 }]}>
            <View style={styles.avatarRing}>
              <LinearGradient colors={['#7b8eff', '#4fdbcc']} style={styles.avatarGrad}>
                <View style={styles.avatarInner}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              </LinearGradient>
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerName} numberOfLines={1}>
                {user?.email ? user.email.split('@')[0] : 'Guest'}
              </Text>
              <View style={styles.headerStatusRow}>
                <View style={[styles.statusDot, user ? styles.statusOnline : undefined]} />
                <Text style={styles.headerSub} numberOfLines={1}>
                  {user ? 'Synced' : 'Offline'}
                </Text>
              </View>
            </View>
          </View>

          <Animated.ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {rows.map((r) => {
              const i = indexOf(r.id);
              if (r.id === primaryItems[0].id) {
                return (
                  <React.Fragment key={r.id}>
                    {renderRow(r, i)}
                    <Animated.View
                      key="divider-a"
                      style={[styles.divider, { opacity: rowOpacity(rows.length - 1) }]}
                    />
                  </React.Fragment>
                );
              }
              if (r.group === 'tools' && r.id === toolItems[0].id) {
                return (
                  <React.Fragment key={r.id}>
                    <Animated.Text
                      style={[styles.sectionLabel, { opacity: rowOpacity(i) }]}
                    >
                      TOOLS
                    </Animated.Text>
                    {renderRow(r, i)}
                  </React.Fragment>
                );
              }
              if (r.group === 'system' && r.id === systemItems[0].id) {
                return (
                  <React.Fragment key={r.id}>
                    <Animated.Text
                      style={[styles.sectionLabel, { opacity: rowOpacity(i) }]}
                    >
                      SYSTEM
                    </Animated.Text>
                    {renderRow(r, i)}
                  </React.Fragment>
                );
              }
              return renderRow(r, i);
            })}
          </Animated.ScrollView>

          <Animated.View
            style={[styles.panelFooter, { opacity: rowOpacity(rows.length), paddingBottom: insets.bottom + 10 }]}
          >
            <Text style={styles.footerText}>MERIDIAN</Text>
          </Animated.View>
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  edgeStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 22,
    zIndex: 30,
  },
  trigger: {
    position: 'absolute',
    left: 0,
    width: 44,
    height: 44,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    backgroundColor: 'rgba(16, 16, 22, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  layer: {
    zIndex: 60,
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: '#0A0A10',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 12, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  avatarRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0A0A10',
    borderWidth: 2,
    borderColor: 'rgba(123, 142, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGrad: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  headerTextWrap: { flex: 1 },
  headerName: {
    fontSize: 15,
    fontWeight: '700',
    color: tc.textPrimary,
    letterSpacing: -0.2,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  statusOnline: {
    backgroundColor: tc.stable,
  },
  headerSub: {
    fontSize: 11,
    color: tc.textMuted,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.8,
    marginTop: 20,
    marginBottom: 2,
    marginLeft: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 8,
    marginHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  rowActive: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: tc.action,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconPlain: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  rowIconActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  rowIconGrad: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
  rowLabelActive: {
    fontWeight: '600',
    color: tc.textPrimary,
  },
  panelFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 2,
  },
});