/**
 * Onboarding was removed — Meridian is single-user and opens straight into
 * MainTabs. These guards make sure a legacy install's `isOnboarded: false`
 * cannot resurrect the welcome flow, and that real data survives the bump.
 */
import { migrateFinancePersisted, useFinanceStore } from '../store';

describe('onboarding removal', () => {
  it('no longer exposes onboarding state or actions', () => {
    const state: any = useFinanceStore.getState();
    for (const key of [
      'isOnboarded', 'onboardingName', 'onboardingGoals', 'onboardingDob',
      'onboardingGender', 'completeOnboarding', 'updateOnboardingName',
    ]) {
      expect(key in state).toBe(false);
    }
  });

  it('migration strips legacy keys but keeps every real entity', () => {
    const migrated: any = migrateFinancePersisted({
      isOnboarded: false,
      onboardingName: 'Old Name',
      onboardingGoals: ['Finance'],
      onboardingDob: '01/01/2000',
      onboardingGender: 'male',
      transactions: [{ id: 'tx1' }],
      cards: [{ id: 'c1' }],
      wallets: [{ id: 'w1' }],
    });

    expect(migrated.isOnboarded).toBeUndefined();
    expect(migrated.onboardingName).toBeUndefined();
    expect(migrated.onboardingGoals).toBeUndefined();
    expect(migrated.onboardingDob).toBeUndefined();
    expect(migrated.onboardingGender).toBeUndefined();
    expect(migrated.transactions).toEqual([{ id: 'tx1' }]);
    expect(migrated.cards).toEqual([{ id: 'c1' }]);
    expect(migrated.wallets).toEqual([{ id: 'w1' }]);
  });

  it('migration still supplies wallets for very old backups', () => {
    expect(migrateFinancePersisted({ transactions: [] }).wallets).toEqual([]);
  });
});
