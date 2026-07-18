import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../shared/theme/colors';
import { useFinanceStore } from '../modules/finance/store';

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

import GarageDashboardScreen from '../modules/garage/screens/GarageDashboardScreen';
import AddFuelFillScreen from '../modules/garage/screens/AddFuelFillScreen';
import EditFuelFillScreen from '../modules/garage/screens/EditFuelFillScreen';

import TasksDashboardScreen from '../modules/tasks/screens/TasksDashboardScreen';
import TaskDetailScreen from '../modules/tasks/screens/TaskDetailScreen';
import AddEditTaskScreen from '../modules/tasks/screens/AddEditTaskScreen';

import InvestmentsDashboardScreen from '../modules/equity/screens/InvestmentsDashboardScreen';
import PortfolioHistoryScreen from '../modules/equity/screens/PortfolioHistoryScreen';
import AIRecommendationsScreen from '../modules/equity/screens/AIRecommendationsScreen';

import MoreMenuScreen from '../modules/personal/screens/MoreMenuScreen';
import PersonalNotesScreen from '../modules/personal/screens/PersonalNotesScreen';
import GoalsTrackerScreen from '../modules/personal/screens/GoalsTrackerScreen';
import RecipesLibraryScreen from '../modules/personal/screens/RecipesLibraryScreen';
import DietPlanTrackerScreen from '../modules/personal/screens/DietPlanTrackerScreen';

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
};

export type GarageStackParamList = {
  GarageDashboard: undefined;
  AddFuelFill: undefined;
  EditFuelFill: { fillId: string };
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
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  PersonalNotes: undefined;
  GoalsTracker: undefined;
  RecipesLibrary: undefined;
  DietPlanTracker: undefined;
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

function FinanceStackNavigator() {
  return (
    <FinanceStack.Navigator screenOptions={{ headerShown: false }}>
      <FinanceStack.Screen name="FinanceHome" component={FinanceHomeScreen} />
      <FinanceStack.Screen name="AddExpense" component={AddExpenseScreen} />
      <FinanceStack.Screen name="EditTransaction" component={EditTransactionScreen} />
      <FinanceStack.Screen name="BankAccounts" component={BankAccountsScreen} />
      <FinanceStack.Screen name="RecurringExpenses" component={RecurringExpensesScreen} />
      <FinanceStack.Screen name="LentBorrowed" component={LentBorrowedScreen} />
      <FinanceStack.Screen name="ExpenseConfirmation" component={ExpenseConfirmationScreen} />
      <FinanceStack.Screen name="MonthlySpend" component={MonthlySpendScreen} />
      <FinanceStack.Screen name="FixedExpenses" component={FixedExpensesScreen} />
      <FinanceStack.Screen name="FinanceReports" component={FinanceReportsScreen} />
      <FinanceStack.Screen name="AllTransactions" component={AllTransactionsScreen} />
      <FinanceStack.Screen name="CreditCards" component={CreditCardsScreen} />
    </FinanceStack.Navigator>
  );
}

function GarageStackNavigator() {
  return (
    <GarageStack.Navigator screenOptions={{ headerShown: false }}>
      <GarageStack.Screen name="GarageDashboard" component={GarageDashboardScreen} />
      <GarageStack.Screen name="AddFuelFill" component={AddFuelFillScreen} />
      <GarageStack.Screen name="EditFuelFill" component={EditFuelFillScreen} />
    </GarageStack.Navigator>
  );
}

function TasksStackNavigator() {
  return (
    <TasksStack.Navigator screenOptions={{ headerShown: false }}>
      <TasksStack.Screen name="TasksDashboard" component={TasksDashboardScreen} />
      <TasksStack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <TasksStack.Screen name="AddEditTask" component={AddEditTaskScreen} />
    </TasksStack.Navigator>
  );
}

function InvestmentsStackNavigator() {
  return (
    <InvestmentsStack.Navigator screenOptions={{ headerShown: false }}>
      <InvestmentsStack.Screen name="InvestmentsDashboard" component={InvestmentsDashboardScreen} />
      <InvestmentsStack.Screen name="PortfolioHistory" component={PortfolioHistoryScreen} />
      <InvestmentsStack.Screen name="AIRecommendations" component={AIRecommendationsScreen} />
    </InvestmentsStack.Navigator>
  );
}

function MoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreMenu" component={MoreMenuScreen} />
      <MoreStack.Screen name="PersonalNotes" component={PersonalNotesScreen} />
      <MoreStack.Screen name="GoalsTracker" component={GoalsTrackerScreen} />
      <MoreStack.Screen name="RecipesLibrary" component={RecipesLibraryScreen} />
      <MoreStack.Screen name="DietPlanTracker" component={DietPlanTrackerScreen} />
    </MoreStack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'card-outline';

          if (route.name === 'FinanceTab') {
            iconName = 'wallet-outline';
          } else if (route.name === 'GarageTab') {
            iconName = 'car-outline';
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
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: 'rgba(255, 255, 255, 0.05)',
          height: 80,
          paddingBottom: 20,
          paddingTop: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="FinanceTab"
        component={FinanceStackNavigator}
        options={{ tabBarLabel: 'Finance' }}
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
        options={{ tabBarLabel: 'Investments' }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStackNavigator}
        options={{ tabBarLabel: 'Notes' }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const isOnboarded = useFinanceStore((state) => state.isOnboarded);

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {!isOnboarded ? (
        <>
          <RootStack.Screen name="WelcomeSplash" component={WelcomeSplashScreen} />
          <RootStack.Screen name="NameEntry" component={NameEntryScreen} />
          <RootStack.Screen name="GoalSelection" component={GoalSelectionScreen} />
          <RootStack.Screen name="IdentityDetails" component={IdentityDetailsScreen} />
        </>
      ) : (
        <>
          <RootStack.Screen name="MainTabs" component={TabNavigator} />
          <RootStack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      )}
    </RootStack.Navigator>
  );
}
