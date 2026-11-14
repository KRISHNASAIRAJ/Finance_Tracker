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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mc } from '../theme/meridian';
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
  /** The icon colour. */
  color: string;
  /** The icon tile background. */
  bg: string;
};

type Group = {
  title: string | null;
  items: Item[];
};

const TAB_NAMES = new Set(['MainHome', 'FinanceHome', 'GarageDashboard', 'TasksDashboard', 'InvestmentsDashboard']);

const ACTIVE_MAP: Record<string, string> = {
  MainHome: 'home',
  FinanceHome: 'finance',
  GarageDashboard: 'garage',
  TasksDashboard: 'tasks',
  InvestmentsDashboard: 'wealth',
  HabitTracker: 'habits',
  MealLogger: 'meals',
  SleepTracker: 'sleep',
  CareerTracker: 'career',
  CareerGoals: 'goals',
  WeeklyDiary: 'diary',
  BuyList: 'buylist',
  Offers: 'offers',
  PersonalNotes: 'notes',
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
        if (isOpenRef.current) return;
        snap(false);
      },
    })
  ).current;

  const panelResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dx < 0 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => {
        if (isOpenRef.current) return;
        const p = Math.max(0, Math.min(1, 1 + g.dx / DRAWER_W));
        progress.setValue(p);
        dragX.setValue(0);
      },
      onPanResponderRelease: (_e, g) => {
        if (isOpenRef.current) return;
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
    setTimeout(signOut, 120);
  };

  // Flat nav — every module in one list, grouped the way the reference
  // design groups it. Habits / Finance / Garage / Tasks / Wealth are
  // reachable from the bottom tab bar, so they are not repeated here.
  const groups: Group[] = useMemo(() => {
    const daily: Item[] = [
      {
        id: 'home',
        label: 'Home',
        icon: 'home-outline',
        color: mc.white,
        bg: mc.red,
        onPress: () => go(() => navigation.navigate('MainTabs', { screen: 'HomeTab', params: { screen: 'MainHome' } })),
      },
      {
        id: 'meals',
        label: 'Meals',
        icon: 'restaurant-outline',
        color: mc.amber,
        bg: mc.amberDim,
        onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'MealLogger' })),
      },
      {
        id: 'sleep',
        label: 'Sleep',
        icon: 'moon-outline',
        color: mc.violet,
        bg: mc.violetDim,
        onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'SleepTracker' })),
      },
      {
        id: 'diary',
        label: 'Diary',
        icon: 'journal-outline',
        color: mc.sky,
        bg: mc.skyDim,
        onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'WeeklyDiary' })),
      },
      {
        id: 'notes',
        label: 'Notes',
        icon: 'document-text-outline',
        color: mc.mint,
        bg: mc.mintDim,
        onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'PersonalNotes' })),
      },
    ];

    const grow: Item[] = [
      {
        id: 'career',
        label: 'Career',
        icon: 'briefcase-outline',
        color: mc.sky,
        bg: mc.skyDim,
        onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'CareerTracker' })),
      },
      {
        id: 'goals',
        label: 'Career goals',
        icon: 'flag-outline',
        color: mc.redSoft,
        bg: mc.redDim,
        onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'CareerGoals' })),
      },
      {
        id: 'people',
        label: 'Keep in touch',
        icon: 'people-outline',
        color: mc.violet,
        bg: mc.violetDim,
        onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'People' })),
      },
    ];

    const shop: Item[] = [
      {
        id: 'buylist',
        label: 'Buy list',
        icon: 'cart-outline',
        color: mc.amber,
        bg: mc.amberDim,
        onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'BuyList' })),
      },
      {
        id: 'offers',
        label: 'Offers',
        icon: 'pricetags-outline',
        color: mc.mint,
        bg: mc.mintDim,
        onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'Offers' })),
      },
    ];

    const system: Item[] = [
      {
        id: 'settings',
        label: 'Settings and sync',
        icon: 'settings-outline',
        color: mc.textDim,
        bg: mc.raised,
        onPress: () => go(() => navigation.navigate('MoreStack', { screen: 'MoreMenu' })),
      },
      ...(user
        ? [
            {
              id: 'logout',
              label: 'Logout',
              icon: 'power-outline' as const,
              danger: true,
              color: mc.redSoft,
              bg: mc.redDim,
              onPress: signOutWithConfirm,
            },
          ]
        : []),
    ];

    return [
      { title: 'DAILY', items: daily },
      { title: 'GROW', items: grow },
      { title: 'SHOP', items: shop },
      { title: null, items: system },
    ];
  }, [navigation, user]);

  // Flatten for the stagger index.
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const indexOf = (id: string) => flat.findIndex((r) => r.id === id);

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
          <View style={[styles.rowIcon, { backgroundColor: item.bg }]}>
            <Ionicons name={item.icon} size={18} color={item.color} />
          </View>
          <Text
            style={[
              styles.rowLabel,
              item.danger && { color: mc.redSoft },
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
          {/* Header — brand mark + account status */}
          <View style={[styles.panelHeader, { paddingTop: insets.top + 16 }]}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>M</Text>
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.brandName}>Meridian</Text>
              <View style={styles.headerStatusRow}>
                <View style={[styles.statusDot, user ? styles.statusOnline : undefined]} />
                <Text style={styles.headerSub} numberOfLines={1}>
                  {user ? 'Synced just now' : 'Offline'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color={mc.textDim} />
            </TouchableOpacity>
          </View>

          <Animated.ScrollView
            style={styles.scrollFlex}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {groups.map((group, gi) => (
              <React.Fragment key={group.title ?? `sys-${gi}`}>
                {group.title ? (
                  <Animated.Text style={[styles.sectionLabel, { opacity: rowOpacity(indexOf(group.items[0].id)) }]}>
                    {group.title}
                  </Animated.Text>
                ) : (
                  <Animated.View style={[styles.divider, { opacity: rowOpacity(indexOf(group.items[0].id)) }]} />
                )}
                {group.items.map((it) => renderRow(it, indexOf(it.id)))}
              </React.Fragment>
            ))}
          </Animated.ScrollView>

          <Animated.View
            style={[styles.panelFooter, { opacity: rowOpacity(flat.length), paddingBottom: insets.bottom + 10 }]}
          >
            <Text style={styles.footerText}>MERIDIAN · V4</Text>
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
    backgroundColor: mc.overlay,
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: mc.canvas,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: mc.line,
    shadowColor: '#000000',
    shadowOffset: { width: 12, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: mc.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    fontSize: 20,
    fontWeight: '500',
    color: mc.white,
  },
  brandName: {
    fontSize: 19,
    fontWeight: '500',
    color: mc.text,
  },
  headerTextWrap: { flex: 1 },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: mc.textFaint,
  },
  statusOnline: {
    backgroundColor: mc.mint,
  },
  headerSub: {
    fontSize: 12,
    color: mc.mint,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: mc.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollFlex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    color: mc.textDim,
    fontWeight: '500',
    marginTop: 14,
    marginBottom: 4,
    marginLeft: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: mc.line,
    marginTop: 12,
    marginHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 18,
  },
  rowActive: {
    backgroundColor: mc.redDim,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: mc.text,
  },
  rowLabelActive: {
    color: mc.redSoft,
    fontWeight: '500',
  },
  panelFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    letterSpacing: 3,
    color: mc.textGhost,
  },
});
