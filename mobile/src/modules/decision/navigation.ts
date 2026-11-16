/**
 * One place that maps an evidence chip's target to a real route. Using the
 * root navigation ref means the same chip works on Home and on the Why screen
 * regardless of which nested navigator is currently mounted.
 */

import { navigationRef } from '../../navigation/navigationRef';
import type { EvidenceTarget } from './types';

type MoreTarget = Extract<EvidenceTarget, 'SleepTracker' | 'HabitTracker'>;
type FinanceTarget = Exclude<EvidenceTarget, MoreTarget | 'TasksDashboard'>;

function isMoreTarget(target: EvidenceTarget): target is MoreTarget {
  return target === 'SleepTracker' || target === 'HabitTracker';
}

function openFinance(target: FinanceTarget): void {
  navigationRef.navigate('MainTabs', {
    screen: 'FinanceTab',
    params: { screen: target },
  });
}

export function openEvidenceTarget(target: EvidenceTarget): void {
  if (!navigationRef.isReady()) return;
  if (isMoreTarget(target)) {
    navigationRef.navigate('MoreStack', { screen: target });
    return;
  }
  if (target === 'TasksDashboard') {
    navigationRef.navigate('MainTabs', {
      screen: 'TasksTab',
      params: { screen: 'TasksDashboard' },
    });
    return;
  }
  openFinance(target);
}

/** The "Do it / Open" button follows the call's own target. */
export function openCallTarget(target: EvidenceTarget): void {
  openEvidenceTarget(target);
}

/** The "Why this?" button on the Today card. */
export function openWhyScreen(): void {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('MoreStack', { screen: 'WhyThisScore' });
}
