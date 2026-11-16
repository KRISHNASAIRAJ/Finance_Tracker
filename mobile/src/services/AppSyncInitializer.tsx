/**
 * AppSyncInitializer — mounts all module sync hooks globally so data pulls
 * from the cloud on every app launch (not only when a specific screen is
 * visited). Critical for fresh installs where the local store is empty.
 *
 * Garage is handled separately by GarageSyncInitializer (has its own
 * backup-seeding + hydration logic), so it's not mounted here.
 */
import { useFinanceSync } from '../modules/finance/hooks/useFinanceSync';
import { useTasksSync } from '../modules/tasks/hooks/useTasksSync';
import { useEquitySync } from '../modules/equity/hooks/useEquitySync';
import { usePersonalSync } from '../modules/personal/hooks/usePersonalSync';
import { useOffersSync } from '../modules/offers/hooks/useOffersSync';
import { usePeopleSync } from '../modules/people/hooks/usePeopleSync';
import { useMedicationsSync } from '../modules/medications/hooks/useMedicationsSync';
import useUniversalSync from '../hooks/useUniversalSync';

export default function AppSyncInitializer() {
  useFinanceSync();
  useTasksSync();
  useEquitySync();
  usePersonalSync();
  useOffersSync();
  // These used to hydrate only when their screen was opened, so data created
  // on another device was missing until the user navigated there. Plus the
  // two tables (weekly_diary, career_events) that had no pull at all.
  usePeopleSync();
  useMedicationsSync();
  useUniversalSync();
  return null;
}
