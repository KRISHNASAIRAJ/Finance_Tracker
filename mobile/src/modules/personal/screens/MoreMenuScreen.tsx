import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../shared/theme/colors';
import { spacing, rounded } from '../../../shared/theme/spacing';
import { useFinanceStore } from '../../finance/store';
import { MoreStackParamList } from '../../../navigation/RootNavigator';
import SidebarDrawer from '../../../shared/components/SidebarDrawer';

type NavigationProp = NativeStackNavigationProp<MoreStackParamList, 'MoreMenu'>;

export default function MoreMenuScreen() {
  const navigation = useNavigation<NavigationProp>();
  const notifications = useFinanceStore((state) => state.notifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const MENU_ITEMS = [
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Shared slide-out left Drawer */}
      <SidebarDrawer
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigation={navigation}
      />

      {/* Top Header */}
      <View style={styles.appBar}>
        <View style={styles.appBarLeft}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setSidebarOpen(true)}>
            <Ionicons name="menu-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.logoText}>Meridian Extras</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Notifications' as any)}>
          <View style={styles.notificationWrapper}>
            <Ionicons name="notifications-outline" size={22} color={colors.primary} />
            {unreadCount > 0 && <View style={styles.notificationDot} />}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.gridContainer}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: spacing.containerPadding,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onSurface,
  },
  iconButton: {
    padding: 8,
    borderRadius: rounded.full,
  },
  notificationWrapper: {
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  scrollContent: {
    padding: spacing.containerPadding,
    paddingBottom: 40,
  },
  gridContainer: {
    gap: 16,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: rounded.lg,
    padding: spacing.cardPadding,
    position: 'relative',
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
});
