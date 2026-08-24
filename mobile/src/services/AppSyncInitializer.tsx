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

export default function AppSyncInitializer() {
  useFinanceSync();
  useTasksSync();
  useEquitySync();
  usePersonalSync();
  return null;
}
