/**
 * RootNavigator — Root React Navigation setup: bottom tab navigator and all stack screens.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../shared/theme/colors';
import { useFinanceStore } from '../modules/finance/store';
import { GarageSyncInitializer } from '../modules/garage/hooks/useGarageSync';

// Onboarding Screens
import WelcomeSplashScreen from '../modules/personal/screens/WelcomeSplashScreen';
import NameEntryScreen from '../modules/personal/screens/NameEntryScreen';
import GoalSelectionScreen from '../modules/personal/screens/GoalSelectionScreen';
import IdentityDetailsScreen from '../modules/personal/screens/IdentityDetailsScreen';
import NotificationsScreen from '../modules/personal/screens/NotificationsScreen';

// Screens
import FinanceHomeScreen from '../modules/finance/screens/FinanceHomeScreen';
import AddExpenseScreen from '../modules/finance/screens/AddExpenseScreen';
import EditTransactionScreen from '../modules/finance/screens/EditTransactionScreen';
import BankAccountsScreen from '../modules/finance/screens/BankAccountsScreen';
import RecurringExpensesScreen from '../modules/finance/screens/RecurringExpensesScreen';
import LentBorrowedScreen from '../modules/finance/screens/LentBorrowedScreen';
import ExpenseConfirmationScreen from '../modules/finance/screens/ExpenseConfirmationScreen';
import MonthlySpendScreen from '../modules/finance/screens/MonthlySpendScreen';
import FixedExpensesScreen from '../modules/finance/screens/FixedExpensesScreen';
import FinanceReportsScreen from '../modules/finance/screens/FinanceReportsScreen';
import AllTransactionsScreen from '../modules/finance/screens/AllTransactionsScreen';
import CreditCardsScreen from '../modules/finance/screens/CreditCardsScreen';
import BalanceSummaryScreen from '../modules/finance/screens/BalanceSummaryScreen';
import CreditCardDetailScreen from '../modules/finance/screens/CreditCardDetailScreen';
import CardAssistantScreen from '../modules/finance/screens/CardAssistantScreen';
import PayzappWalletScreen from '../modules/finance/screens/PayzappWalletScreen';
import CardChatScreen from '../modules/finance/screens/CardChatScreen';

import GarageDashboardScreen from '../modules/garage/screens/GarageDashboardScreen';
import AddFuelFillScreen from '../modules/garage/screens/AddFuelFillScreen';
import EditFuelFillScreen from '../modules/garage/screens/EditFuelFillScreen';
import AllFuelFillsScreen from '../modules/garage/screens/AllFuelFillsScreen';
import VehicleSpendScreen from '../modules/garage/screens/VehicleSpendScreen';
import VehicleReportsScreen from '../modules/garage/screens/VehicleReportsScreen';
import AddMaintenanceScreen from '../modules/garage/screens/AddMaintenanceScreen';
import AllMaintenanceScreen from '../modules/garage/screens/AllMaintenanceScreen';

import TasksDashboardScreen from '../modules/tasks/screens/TasksDashboardScreen';
import TaskDetailScreen from '../modules/tasks/screens/TaskDetailScreen';
import AddEditTaskScreen from '../modules/tasks/screens/AddEditTaskScreen';

import InvestmentsDashboardScreen from '../modules/equity/screens/InvestmentsDashboardScreen';
import PortfolioHistoryScreen from '../modules/equity/screens/PortfolioHistoryScreen';
import AIRecommendationsScreen from '../modules/equity/screens/AIRecommendationsScreen';
import AddEditHoldingScreen from '../modules/equity/screens/AddEditHoldingScreen';
import AddEditGoalScreen from '../modules/equity/screens/AddEditGoalScreen';
import HoldingsListScreen from '../modules/equity/screens/HoldingsListScreen';
import AllocationDetailScreen from '../modules/equity/screens/AllocationDetailScreen';

import MoreMenuScreen from '../modules/personal/screens/MoreMenuScreen';
import PersonalNotesScreen from '../modules/personal/screens/PersonalNotesScreen';
import CombinedReportScreen from '../modules/personal/screens/CombinedReportScreen';
import GoalsTrackerScreen from '../modules/personal/screens/GoalsTrackerScreen';
import RecipesLibraryScreen from '../modules/personal/screens/RecipesLibraryScreen';
import CareerTrackerScreen from '../modules/career/screens/CareerTrackerScreen';
import AddCareerEventScreen from '../modules/career/screens/AddCareerEventScreen';
import MealLoggerScreen from '../modules/meals/screens/MealLoggerScreen';
import MealAISuggestionsScreen from '../modules/meals/screens/MealAISuggestionsScreen';
import MealAIConfirmScreen from '../modules/meals/screens/MealAIConfirmScreen';
import MealEditScreen from '../modules/meals/screens/MealEditScreen';
import WeightTrackerScreen from '../modules/meals/screens/WeightTrackerScreen';
import DietViewerScreen from '../modules/meals/screens/DietViewerScreen';
import WeeklyDiaryScreen from '../modules/diary/screens/WeeklyDiaryScreen';

// Stack Parameter Lists
export type FinanceStackParamList = {
  FinanceHome: undefined;
  AddExpense: undefined;
  EditTransaction: { transactionId: string };
  BankAccounts: undefined;
  RecurringExpenses: undefined;
  LentBorrowed: undefined;
  ExpenseConfirmation: { transactionId: string };
  MonthlySpend: undefined;
  FixedExpenses: undefined;
  FinanceReports: undefined;
  AllTransactions: undefined;
  CreditCards: undefined;
  BalanceSummary: undefined;
  CreditCardDetail: { cardId: string };
  CardAssistant: undefined;
  PayzappWallet: undefined;
  CardChat: { documentId?: string; documentName?: string } | undefined;
};

export type GarageStackParamList = {
  GarageDashboard: undefined;
  AddFuelFill: undefined;
  EditFuelFill: { fillId: string };
  AllFuelFills: undefined;
  VehicleSpend: undefined;
  VehicleReports: undefined;
  AddMaintenance: { maintenanceId?: string } | undefined;
  AllMaintenance: undefined;
};

export type TasksStackParamList = {
  TasksDashboard: undefined;
  TaskDetail: { taskId: string };
  AddEditTask: { taskId?: string };
};

export type InvestmentsStackParamList = {
  InvestmentsDashboard: undefined;
  PortfolioHistory: undefined;
  AIRecommendations: undefined;
  HoldingsList: { tab?: 'equity' | 'mf' } | undefined;
  AddEditHolding: { holdingId?: string } | undefined;
  AddEditGoal: { goalId?: string } | undefined;
  AllocationDetail: undefined;
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  CombinedReport: undefined;
  PersonalNotes: undefined;
  GoalsTracker: undefined;
  RecipesLibrary: undefined;
  CareerTracker: undefined;
  AddCareerEvent: { eventId?: string } | undefined;
  MealLogger: undefined;
  MealAISuggestions: undefined;
  MealAIConfirm: { imageBase64?: string; textDescription?: string; mealType?: string } | undefined;
  MealEdit: { entryId?: string; date?: string; mealType?: string } | undefined;
  WeightTracker: undefined;
  DietViewer: undefined;
  WeeklyDiary: undefined;
};

export type RootTabParamList = {
  FinanceTab: undefined;
  GarageTab: undefined;
  TasksTab: undefined;
  InvestmentsTab: undefined;
  MoreTab: undefined;
};

export type RootStackParamList = {
  WelcomeSplash: undefined;
  NameEntry: undefined;
  GoalSelection: { name: string };
  IdentityDetails: { name: string; goals: string[] };
  MainTabs: undefined;
  Notifications: undefined;
};

const FinanceStack = createNativeStackNavigator<FinanceStackParamList>();
const GarageStack = createNativeStackNavigator<GarageStackParamList>();
const TasksStack = createNativeStackNavigator<TasksStackParamList>();
const InvestmentsStack = createNativeStackNavigator<InvestmentsStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const stackScreenOptions = {
  headerShown: false,
  animation: 'slide_from_right' as const,
  contentStyle: { backgroundColor: colors.background },
};

const modalScreenOptions = {
  headerShown: false,
  animation: 'slide_from_bottom' as const,
  presentation: 'modal' as const,
  contentStyle: { backgroundColor: colors.background },
};

// Screens that keep the floating tab bar visible. Every other screen renders full-screen
// (AI assistants, forms, reports, detail screens) so the tab bar never overlaps them.
const TAB_BAR_SCREENS = new Set([
  'FinanceHome',
  'GarageDashboard',
  'TasksDashboard',
  'InvestmentsDashboard',
  'MoreMenu',
]);

function FinanceStackNavigator() {
  return (
    <FinanceStack.Navigator screenOptions={stackScreenOptions}>
      <FinanceStack.Screen name="FinanceHome" component={FinanceHomeScreen} />
      <FinanceStack.Screen name="AddExpense" component={AddExpenseScreen} options={modalScreenOptions} />
      <FinanceStack.Screen name="EditTransaction" component={EditTransactionScreen} />
      <FinanceStack.Screen name="BankAccounts" component={BankAccountsScreen} />
      <FinanceStack.Screen name="RecurringExpenses" component={RecurringExpensesScreen} />
      <FinanceStack.Screen name="LentBorrowed" component={LentBorrowedScreen} />
      <FinanceStack.Screen name="ExpenseConfirmation" component={ExpenseConfirmationScreen} options={modalScreenOptions} />
      <FinanceStack.Screen name="MonthlySpend" component={MonthlySpendScreen} />
      <FinanceStack.Screen name="FixedExpenses" component={FixedExpensesScreen} />
      <FinanceStack.Screen name="FinanceReports" component={FinanceReportsScreen} />
      <FinanceStack.Screen name="AllTransactions" component={AllTransactionsScreen} />
      <FinanceStack.Screen name="CreditCards" component={CreditCardsScreen} />
      <FinanceStack.Screen name="BalanceSummary" component={BalanceSummaryScreen} />
      <FinanceStack.Screen name="CreditCardDetail" component={CreditCardDetailScreen} />
      <FinanceStack.Screen name="CardAssistant" component={CardAssistantScreen} />
      <FinanceStack.Screen name="PayzappWallet" component={PayzappWalletScreen} />
      <FinanceStack.Screen name="CardChat" component={CardChatScreen} />
    </FinanceStack.Navigator>
  );
}

function GarageStackNavigator() {
  return (
    <GarageStack.Navigator screenOptions={stackScreenOptions}>
      <GarageStack.Screen name="GarageDashboard" component={GarageDashboardScreen} />
      <GarageStack.Screen name="AddFuelFill" component={AddFuelFillScreen} />
      <GarageStack.Screen name="EditFuelFill" component={EditFuelFillScreen} />
      <GarageStack.Screen name="AllFuelFills" component={AllFuelFillsScreen} />
      <GarageStack.Screen name="VehicleSpend" component={VehicleSpendScreen} />
      <GarageStack.Screen name="VehicleReports" component={VehicleReportsScreen} />
      <GarageStack.Screen name="AddMaintenance" component={AddMaintenanceScreen} />
      <GarageStack.Screen name="AllMaintenance" component={AllMaintenanceScreen} />
    </GarageStack.Navigator>
  );
}

function TasksStackNavigator() {
  return (
    <TasksStack.Navigator screenOptions={stackScreenOptions}>
      <TasksStack.Screen name="TasksDashboard" component={TasksDashboardScreen} />
      <TasksStack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <TasksStack.Screen name="AddEditTask" component={AddEditTaskScreen} />
    </TasksStack.Navigator>
  );
}

function InvestmentsStackNavigator() {
  return (
    <InvestmentsStack.Navigator screenOptions={stackScreenOptions}>
      <InvestmentsStack.Screen name="InvestmentsDashboard" component={InvestmentsDashboardScreen} />
      <InvestmentsStack.Screen name="PortfolioHistory" component={PortfolioHistoryScreen} />
      <InvestmentsStack.Screen name="AIRecommendations" component={AIRecommendationsScreen} />
      <InvestmentsStack.Screen name="AddEditHolding" component={AddEditHoldingScreen} />
      <InvestmentsStack.Screen name="AddEditGoal" component={AddEditGoalScreen} />
      <InvestmentsStack.Screen name="HoldingsList" component={HoldingsListScreen} />
      <InvestmentsStack.Screen name="AllocationDetail" component={AllocationDetailScreen} />
    </InvestmentsStack.Navigator>
  );
}

function MoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={stackScreenOptions}>
      <MoreStack.Screen name="MoreMenu" component={MoreMenuScreen} />
      <MoreStack.Screen name="CombinedReport" component={CombinedReportScreen} />
      <MoreStack.Screen name="PersonalNotes" component={PersonalNotesScreen} />
      <MoreStack.Screen name="GoalsTracker" component={GoalsTrackerScreen} />
      <MoreStack.Screen name="RecipesLibrary" component={RecipesLibraryScreen} />
      <MoreStack.Screen name="CareerTracker" component={CareerTrackerScreen} />
      <MoreStack.Screen name="AddCareerEvent" component={AddCareerEventScreen} options={modalScreenOptions} />
      <MoreStack.Screen name="MealLogger" component={MealLoggerScreen} />
      <MoreStack.Screen name="MealAISuggestions" component={MealAISuggestionsScreen} />
      <MoreStack.Screen name="MealAIConfirm" component={MealAIConfirmScreen} />
      <MoreStack.Screen name="MealEdit" component={MealEditScreen} />
      <MoreStack.Screen name="WeightTracker" component={WeightTrackerScreen} />
      <MoreStack.Screen name="DietViewer" component={DietViewerScreen} />
      <MoreStack.Screen name="WeeklyDiary" component={WeeklyDiaryScreen} />
    </MoreStack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const focusedRouteName = getFocusedRouteNameFromRoute(route) ?? '';
        const showTabBar = focusedRouteName === '' || TAB_BAR_SCREENS.has(focusedRouteName);

        return {
          tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'card-outline';

          if (route.name === 'FinanceTab') {
            iconName = 'wallet-outline';
          } else if (route.name === 'GarageTab') {
            iconName = 'bicycle-outline';
          } else if (route.name === 'TasksTab') {
            iconName = 'checkbox-outline';
          } else if (route.name === 'InvestmentsTab') {
            iconName = 'trending-up-outline';
          } else if (route.name === 'MoreTab') {
            iconName = 'ellipsis-horizontal-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.outline,
          tabBarStyle: showTabBar
            ? {
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 10,
                height: 76,
                paddingBottom: 12,
                paddingTop: 10,
                borderRadius: 28,
                backgroundColor: 'rgba(15, 15, 17, 0.85)',
                borderTopColor: 'rgba(255, 255, 255, 0.12)',
                borderTopWidth: StyleSheet.hairlineWidth,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(255, 255, 255, 0.12)',
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.5,
                shadowRadius: 24,
                elevation: 12,
              }
            : { display: 'none' },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
          headerShown: false,
          animation: 'shift' as const,
        };
      }}
    >
      <Tab.Screen
        name="FinanceTab"
        component={FinanceStackNavigator}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="GarageTab"
        component={GarageStackNavigator}
        options={{ tabBarLabel: 'Garage' }}
      />
      <Tab.Screen
        name="TasksTab"
        component={TasksStackNavigator}
        options={{ tabBarLabel: 'Tasks' }}
      />
      <Tab.Screen
        name="InvestmentsTab"
        component={InvestmentsStackNavigator}
        options={{ tabBarLabel: 'Wealth' }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStackNavigator}
        options={{ tabBarLabel: 'More' }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const isOnboarded = useFinanceStore((state) => state.isOnboarded);

  return (
    <>
      {isOnboarded && <GarageSyncInitializer />}
      <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade' as const,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {!isOnboarded ? (
        <>
          <RootStack.Screen name="WelcomeSplash" component={WelcomeSplashScreen} />
          <RootStack.Screen name="NameEntry" component={NameEntryScreen} options={{ animation: 'slide_from_right' }} />
          <RootStack.Screen name="GoalSelection" component={GoalSelectionScreen} />
          <RootStack.Screen name="IdentityDetails" component={IdentityDetailsScreen} />
        </>
      ) : (
        <>
          <RootStack.Screen name="MainTabs" component={TabNavigator} />
          <RootStack.Screen name="Notifications" component={NotificationsScreen} options={modalScreenOptions} />
        </>
      )}
    </RootStack.Navigator>
    </>
  );
}
