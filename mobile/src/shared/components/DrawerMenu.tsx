/**
 * DrawerMenu — global slide-in sidebar.
 *
 * Core Animated only (no reanimated/gesture-handler deps):
 *  - springs open from the left with a fading backdrop
 *  - left-edge swipe to open, drawer swipe/backdrop/back-button to close
 *  - staggered row entrance driven by the same progress value
 *  - active route highlight so you always know where you are
 *  - trigger is visible on ALL main tabs as soon as the store hydrates
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
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tc } from '../theme/tracend';
import { useDrawerStore } from '../useDrawerStore';
import { useFinanceStore } from '../../modules/finance/store';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { navigationRef, getActiveRouteNameFromRef } from '../../navigation/navigationRef';
import { useAuth } from '../../services/AuthProvider';

type RootNav = NativeStackNavigationProp<RootStackParamList>;

const SCREEN_W = Dimensions.get('window').width;
const DRAWER_W = Math.min(304, SCREEN_W * 0.82);

type Item = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  danger?: boolean;
  grad?: readonly [string, string];
};

const TAB_NAMES = new Set(['MainHome', 'FinanceHome', 'GarageDashboard', 'TasksDashboard', 'InvestmentsDashboard']);

const ACTIVE_MAP: Record<string, string> = {
  MainHome: 'home',
  FinanceHome: 'finance',
  GarageDashboard: 'garage',
  TasksDashboard: 'tasks',
  InvestmentsDashboard: 'wealth',
};

export default function DrawerMenu() {
  const navigation = useNavigation<RootNav>();
  const { isOpen, open, close } = useDrawerStore();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  // Hydration-aware onboarding gate: until the finance store finishes
  // hydrating, assume onboarded so the trigger is never delayed on launch.
  const isOnboarded = useFinanceStore((state) => state.isOnboarded);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const store = useFinanceStore;
    if (store.persist?.hasHydrated?.()) {
      setHydrated(true);
      return;
    }
    const unsub = store.persist?.onFinishHydration?.(() => setHydrated(true));
    return () => { unsub?.(); };
  }, []);
  const effectiveOnboarded = isOnboarded || !hydrated;

  const [activeRouteName, setActiveRouteName] = useState<string | undefined>(() =>
    getActiveRouteNameFromRef()
  );

  // Reactive route tracking: recomputes on every navigation-state change
  // (tab switches, stack pushes/pops, conditional WelcomeSplash→MainTabs swap).
  // Uses the shared container ref's 'state' listener instead of
  // useNavigationState — this component renders OUTSIDE any navigator
  // (sibling of RootNavigator in App.tsx), where useNavigationState throws
  // "Couldn't get the navigation state" in React Navigation v7.
  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const sync = () => {
      if (mounted) setActiveRouteName(getActiveRouteNameFromRef());
    };
    const attach = () => {
      unsub = navigationRef.addListener('state', sync);
      sync();
    };
    sync();
    if (navigationRef.isReady()) {
      attach();
    } else {
      // Ref not ready yet: poll until it is, then attach the listener.
      timer = setInterval(() => {
        if (navigationRef.isReady()) {
          if (timer) clearInterval(timer);
          timer = null;
          attach();
        }
      }, 100);
    }
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
      unsub?.();
    };
  }, []);

  // Fallback safety net: if the state listener somehow missed the initial
  // mount (rare timing on cold start), poll briefly until a real TAB name
  // appears so the trigger always shows on first open.
  useEffect(() => {
    if (activeRouteName && TAB_NAMES.has(activeRouteName)) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const name = getActiveRouteNameFromRef();
      if (name && TAB_NAMES.has(name)) {
        setActiveRouteName(name);
        clearInterval(timer);
      } else if (attempts >= 100) {
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [activeRouteName]);

  const isTabScreen = activeRouteName ? TAB_NAMES.has(activeRouteName) : false;
  // The hamburger trigger is now rendered per-screen (DrawerTrigger) by each
  // tab dashboard, so visibility no longer depends on nav-state timing.
  // The left edge strip (swipe-to-open) stays global and unconditional on
  // onboarded tab screens.
  const showEdge = effectiveOnboarded && isTabScreen;
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

  const toolItems: Item[] = [
    { id: 'habits', label: 'Habit Tracker', icon: 'checkmark-circle-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'HabitTracker' })) },
    { id: 'sleep', label: 'Sleep Tracker', icon: 'moon-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'SleepTracker' })) },
    { id: 'careergoals', label: 'Career Goals', icon: 'flag-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'CareerGoals' })) },
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
    { id: 'dailyreport', label: 'Daily Report', icon: 'newspaper-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'DailyReport' })) },
    { id: 'buylist', label: 'Buy List', icon: 'cart-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'BuyList' })) },
    { id: 'grocerylist', label: 'Grocery List', icon: 'basket-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'GroceryList' })) },
  ];

  const systemItems: Item[] = [
    { id: 'settings', label: 'Settings & Sync', icon: 'settings-outline', onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'MoreMenu' })) },
    ...(user
      ? [{ id: 'logout', label: 'Logout', icon: 'power-outline' as const, danger: true, onPress: signOutWithConfirm }]
      : []),
  ];

  const rows = useMemo(() => [
    ...toolItems.map((it) => ({ ...it, group: 'tools' as const })),
    ...systemItems.map((it) => ({ ...it, group: 'system' as const })),
  ], []);

  const indexOf = (id: string) => rows.findIndex((r) => r.id === id);

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
          {item.grad && <LinearGradient colors={[item.grad[0], item.grad[1]]} style={styles.rowAccent} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />}
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
                <Ionicons name={item.icon} size={17} color="#0A0A10" />
              </LinearGradient>
            ) : (
              <Ionicons
                name={item.icon}
                size={19}
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
          {isActive && <View style={styles.rowActiveDot} />}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Progress ring for today's habits (Telos-style "progress is motivation")
  const habitRing = (() => {
    const { useHabitStore } = require('../../modules/habits/store');
    const { habitsForDay } = require('../../modules/habits/store');
    const { todayKey, dayProgress } = require('../../modules/habits/habits');
    const days = useHabitStore.getState().days;
    const ticked = habitsForDay(days, todayKey());
    const p = dayProgress(ticked);
    const R = 17;
    const C = 2 * Math.PI * R;
    return { pct: Math.round(p * 100), C, dash: C * (1 - p), done: ticked.length };
  })();

  return (
    <>
      {showEdge && <View style={styles.edgeStrip} {...edgeResponder.panHandlers} />}

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
          {/* Warm Telos-style aurora backdrop */}
          <LinearGradient
            colors={['#1a1440', '#101018', '#0A0A10']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.panelGlow}
            pointerEvents="none"
          />
          <View style={styles.aurora1} pointerEvents="none" />
          <View style={styles.aurora2} pointerEvents="none" />

          {/* Header — hero card with habit progress ring */}
          <View style={[styles.panelHeader, { paddingTop: insets.top + 18 }]}>
            <View style={styles.ringWrap}>
              <Svg width={44} height={44}>
                <Circle cx={22} cy={22} r={17} stroke="rgba(255,255,255,0.10)" strokeWidth={4} fill="none" />
                <Circle
                  cx={22}
                  cy={22}
                  r={17}
                  stroke="#4fdbcc"
                  strokeWidth={4}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${habitRing.C}`}
                  strokeDashoffset={`${habitRing.dash}`}
                  transform="rotate(-90 22 22)"
                />
              </Svg>
              <View style={styles.ringCenter}>
                <Text style={styles.ringPct}>{habitRing.pct}%</Text>
              </View>
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerName} numberOfLines={1}>
                {user?.email ? user.email.split('@')[0] : 'Guest'}
              </Text>
              <View style={styles.headerStatusRow}>
                <View style={[styles.statusDot, user ? styles.statusOnline : undefined]} />
                <Text style={styles.headerSub} numberOfLines={1}>
                  {habitRing.done}/10 habits · {user ? 'synced' : 'offline'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color={tc.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Bricks of progress strip (Telos city metaphor) */}
          <View style={styles.bricksStrip}>
            {Array.from({ length: 10 }).map((_, i) => (
              <View key={i} style={[styles.brick, i < Math.round(habitRing.pct / 10) && styles.brickLit]} />
            ))}
            <Text style={styles.bricksLabel}>build your city, one brick at a time</Text>
          </View>

          <Animated.ScrollView
            style={styles.scrollFlex}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {rows.map((r) => {
              const i = indexOf(r.id);
              if (r.id === toolItems[0].id) {
                return (
                  <React.Fragment key={r.id}>
                    <Animated.Text style={[styles.sectionLabel, { opacity: rowOpacity(i) }]}>
                      TOOLBELT
                    </Animated.Text>
                    {renderRow(r, i)}
                  </React.Fragment>
                );
              }
              if (r.group === 'system' && r.id === systemItems[0].id) {
                return (
                  <React.Fragment key={r.id}>
                    <Animated.View
                      key="divider-b"
                      style={[styles.divider, { opacity: rowOpacity(rows.length - 1) }]}
                    />
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
            <LinearGradient
              colors={['#8b95ff', '#5ee6ff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.footerBrandBar}
            />
            <Text style={styles.footerText}>MERIDIAN · one brick at a time</Text>
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
    zIndex: 100,
    elevation: 100,
  },
  layer: {
    zIndex: 60,
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: '#0A0A10',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000000',
    shadowOffset: { width: 12, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
  },
  panelGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  aurora1: {
    position: 'absolute',
    top: -60,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(139,149,255,0.16)',
    opacity: 0.5,
  },
  aurora2: {
    position: 'absolute',
    top: 90,
    right: -110,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(79,219,204,0.10)',
    opacity: 0.5,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  ringWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4fdbcc',
    letterSpacing: -0.3,
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
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bricksStrip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  brick: {
    width: 14,
    height: 8,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  brickLit: {
    backgroundColor: '#4fdbcc',
    shadowColor: '#4fdbcc',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 3,
  },
  bricksLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.30)',
    letterSpacing: 0.4,
    marginLeft: 6,
  },
  scrollFlex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2.2,
    marginTop: 18,
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
    borderRadius: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  rowActive: {
    backgroundColor: 'rgba(139,149,255,0.10)',
  },
  rowAccent: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    opacity: 0.85,
  },
  rowActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8b95ff',
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconPlain: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  rowIconActive: {
    backgroundColor: 'rgba(139,149,255,0.14)',
  },
  rowIconGrad: {
    width: 36,
    height: 36,
    borderRadius: 12,
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
    backgroundColor: '#0A0A10',
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
    gap: 6,
  },
  footerBrandBar: {
    width: 44,
    height: 3,
    borderRadius: 2,
  },
  footerText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 2,
  },
});
