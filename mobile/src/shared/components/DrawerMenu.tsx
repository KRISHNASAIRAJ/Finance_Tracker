/**
 * DrawerMenu — global slide-in sidebar that replaces the More tab.
 * Core Animated only (no reanimated/gesture-handler deps):
 *  - springs open from the left with a fading backdrop
 *  - left-edge swipe to open, drawer swipe/backdrop/back-button to close
 *  - staggered row entrance driven by the same progress value
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

import { tc, glass } from '../theme/tracend';
import { useDrawerStore } from '../useDrawerStore';
import { useFinanceStore } from '../../modules/finance/store';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../services/AuthProvider';

type RootNav = NativeStackNavigationProp<RootStackParamList>;

const SCREEN_W = Dimensions.get('window').width;
const DRAWER_W = Math.min(320, SCREEN_W * 0.84);

/** Walk the navigation state to the focused screen name. */
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

export default function DrawerMenu() {
  const navigation = useNavigation<RootNav>();
  const { isOpen, open, close, toggle } = useDrawerStore();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const isOnboarded = useFinanceStore((state) => state.isOnboarded);

  // Only the FinanceHome screen shows the drawer trigger — every other
  // screen has its own headers/back buttons and the pill would overlap them.
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

  const progress = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;

  const translateX = Animated.add(
    dragX,
    progress.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_W, 0] })
  );
  const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  // Per-row entrance: each item starts fading/sliding at a slightly later progress threshold.
  const rowOpacity = (i: number) =>
    progress.interpolate({ inputRange: [0, 0.2 + i * 0.055, 0.55 + i * 0.055], outputRange: [0, 0, 1] });
  const rowOffset = (i: number) =>
    progress.interpolate({
      inputRange: [0, 0.2 + i * 0.055, 0.55 + i * 0.055],
      outputRange: [-14, -14, 0],
    });

  const openAnim = useCallback(() => {
    dragX.setValue(0);
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 180,
      mass: 0.9,
    }).start();
  }, [progress, dragX]);

  const closeAnim = useCallback(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => dragX.setValue(0));
  }, [progress, dragX]);

  useEffect(() => {
    if (isOpen) openAnim();
    else closeAnim();
  }, [isOpen, openAnim, closeAnim]);

  // Android hardware back closes the drawer first.
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

  // Snap to a state: syncs the store (so pointerEvents/back-key stay correct)
  // AND always runs the animation even when the store value didn't change.
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

  // Left-edge swipe strip → open the drawer.
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

  // Drawer panel drag → follows finger, closes past a threshold.
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
    setTimeout(action, 120); // let the drawer begin closing before the screen swaps
  };

  const signOutWithConfirm = () => {
    close();
    setTimeout(() => signOut(), 120);
  };

  const primaryItems: Item[] = [
    { id: 'home', label: 'Home', icon: 'home-outline', grad: ['#7b8eff', '#3a4fc9'], onPress: () => go(() => navigation.navigate('MainTabs', { screen: 'FinanceTab' })) },
    { id: 'garage', label: 'Garage', icon: 'bicycle-outline', grad: ['#5ee6ff', '#007d8f'], onPress: () => go(() => navigation.navigate('MainTabs', { screen: 'GarageTab' })) },
    { id: 'tasks', label: 'Tasks', icon: 'checkbox-outline', grad: ['#ffd9a0', '#e2a45c'], onPress: () => go(() => navigation.navigate('MainTabs', { screen: 'TasksTab' })) },
    { id: 'wealth', label: 'Wealth', icon: 'trending-up-outline', grad: ['#4fdbcc', '#007d73'], onPress: () => go(() => navigation.navigate('MainTabs', { screen: 'InvestmentsTab' })) },
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

  const rows = [
    ...primaryItems.map((it) => ({ ...it, group: 'primary' })),
    ...toolItems.map((it) => ({ ...it, group: 'tools' })),
    ...systemItems.map((it) => ({ ...it, group: 'system' })),
  ];
  const indexOf = (id: string) => rows.findIndex((r) => r.id === id);

  const renderRow = (item: Item, i: number) => (
    <Animated.View
      key={item.id}
      style={{ opacity: rowOpacity(i), transform: [{ translateX: rowOffset(i) }] }}
    >
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.6}
        onPress={item.onPress}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <View style={[styles.rowIcon, item.grad ? undefined : styles.rowIconPlain, item.danger && { backgroundColor: `${tc.attention}18` }]}>
          {item.grad ? (
            <LinearGradient colors={[item.grad[0], item.grad[1]]} style={styles.rowIconGrad}>
              <Ionicons
                name={item.icon}
                size={18}
                color="#ffffff"
              />
            </LinearGradient>
          ) : (
            <Ionicons
              name={item.icon}
              size={20}
              color={item.danger ? tc.attention : tc.textPrimary}
            />
          )}
        </View>
        <Text style={[styles.rowLabel, item.danger && { color: tc.attention }]}>{item.label}</Text>
        <Ionicons name="chevron-forward" size={16} color={tc.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <>
      {/* Left-edge swipe strip — home screen only */}
      {showTrigger && <View style={styles.edgeStrip} {...edgeResponder.panHandlers} />}

      {/* Floating trigger pill — home screen only */}
      {showTrigger && (
        <TouchableOpacity
          style={[styles.trigger, { top: insets.top + 29 }]}
          activeOpacity={0.7}
          onPress={toggle}
        >
          <Ionicons name="menu" size={20} color={tc.textPrimary} />
        </TouchableOpacity>
      )}

      {/* Drawer layer — pointerEvents active only while open */}
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
          <LinearGradient
            colors={['rgba(123,142,255,0.14)', 'rgba(0,0,0,0)']}
            style={styles.panelGlow}
            pointerEvents="none"
          />
          <View style={[styles.panelHeader, { paddingTop: insets.top + 20 }]}>
            <LinearGradient colors={['#7b8eff', '#4a5cc8']} style={styles.brandMark}>
              <Text style={styles.brandLetter}>M</Text>
            </LinearGradient>
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandName}>Meridian</Text>
              <Text style={styles.brandSub} numberOfLines={1}>
                {user?.email ?? 'Offline · sign in to sync'}
              </Text>
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

          <Animated.View style={[styles.panelFooter, { opacity: rowOpacity(rows.length), paddingBottom: insets.bottom + 10 }]}>
            <Text style={styles.footerText}>MERIDIAN v3 · OFFLINE-FIRST</Text>
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
    width: 46,
    height: 46,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    backgroundColor: 'rgba(18, 18, 18, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tc.border,
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
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: '#0d0d12',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: glass.border,
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
    height: 220,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: glass.border,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7b8eff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  brandLetter: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  brandTextWrap: { flex: 1 },
  brandName: {
    fontSize: 16,
    fontWeight: '700',
    color: tc.textPrimary,
    letterSpacing: -0.2,
  },
  brandSub: {
    fontSize: 11,
    color: tc.textMuted,
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: tc.textMuted,
    letterSpacing: 1.4,
    marginTop: 18,
    marginBottom: 4,
    marginLeft: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tc.border,
    marginVertical: 10,
    marginHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconPlain: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rowIconGrad: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: tc.textPrimary,
  },
  panelFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tc.border,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  footerText: {
    fontSize: 9,
    fontWeight: '600',
    color: tc.textMuted,
    letterSpacing: 1.2,
  },
});
