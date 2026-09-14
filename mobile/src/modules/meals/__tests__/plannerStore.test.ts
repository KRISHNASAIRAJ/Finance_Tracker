/**
 * plannerStore.test.ts — meal planner store + helpers.
 */
import { planRowId, plansForDate, MealPlanItem } from '../plannerStore';

describe('planRowId', () => {
  it('is deterministic per date+slot', () => {
    expect(planRowId('2026-09-15', 'breakfast')).toBe('mp_20260915_breakfast');
    expect(planRowId('2026-09-15', 'breakfast')).toBe(planRowId('2026-09-15', 'breakfast'));
    expect(planRowId('2026-09-15', 'dinner')).not.toBe(planRowId('2026-09-15', 'breakfast'));
  });
});

describe('plansForDate', () => {
  it('groups plans by slot for a date', () => {
    const plans: MealPlanItem[] = [
      { id: 'a', date: '2026-09-15', slot: 'breakfast', recipeId: null, title: 'Oats', notes: '', done: false },
      { id: 'b', date: '2026-09-15', slot: 'dinner', recipeId: null, title: 'Dosa', notes: '', done: true },
      { id: 'c', date: '2026-09-16', slot: 'lunch', recipeId: null, title: 'Rice', notes: '', done: false },
    ];
    const bySlot = plansForDate(plans, '2026-09-15');
    expect(bySlot.breakfast?.title).toBe('Oats');
    expect(bySlot.dinner?.done).toBe(true);
    expect(bySlot.lunch).toBeUndefined();
  });
  it('returns empty record shape when nothing planned', () => {
    const bySlot = plansForDate([], '2026-09-15');
    expect(bySlot.breakfast).toBeUndefined();
    expect(bySlot.dinner).toBeUndefined();
  });
});
