import { pickCall } from '../rules';
import { makeInput } from './fixture';

describe('today call rules', () => {
  test('cash gap within 14 days wins and names the receivable', () => {
    const call = pickCall(
      makeInput({
        projection: {
          shortfallDate: '2026-11-24',
          lowestBalancePaise: -100000,
          shortfallPaise: 500000,
          balanceAfterBillBelowMin: true,
        },
        receivable: { name: 'Ravi', date: '2026-11-20', amountPaise: 500000 },
      })
    );
    expect(call.ruleId).toBe('cashflow');
    expect(call.headline).toContain('Ravi');
    expect(call.evidence.length).toBeGreaterThanOrEqual(2);
    expect(call.evidence.length).toBeLessThanOrEqual(3);
  });

  test('bill rule fires when a near bill breaks the minimum', () => {
    const call = pickCall(
      makeInput({
        bill: { name: 'Electricity', date: '2026-11-18', amountPaise: 250000 },
        projection: {
          shortfallDate: null,
          lowestBalancePaise: 0,
          shortfallPaise: 0,
          balanceAfterBillBelowMin: true,
        },
      })
    );
    expect(call.ruleId).toBe('bill');
    expect(call.headline).toContain('Electricity');
  });

  test('budget rule fires only above pace', () => {
    expect(pickCall(makeInput({ budgetPace: 1.3 })).ruleId).toBe('budget');
    expect(pickCall(makeInput({ budgetPace: 0.9 })).ruleId).toBe('steady');
  });

  test('short-night rule needs both a short night and high spend', () => {
    const short = { sleepLastNightMinutes: 300, dailySpendRupees: 2000 };
    expect(pickCall(makeInput(short)).ruleId).toBe('shortNight');
    expect(
      pickCall(makeInput({ sleepLastNightMinutes: 300, dailySpendRupees: 900 })).ruleId
    ).toBe('steady');
    expect(
      pickCall(makeInput({ sleepLastNightMinutes: 420, dailySpendRupees: 2000 })).ruleId
    ).toBe('steady');
  });

  test('overdue urgent task rule', () => {
    const call = pickCall(makeInput({ overdueUrgentTask: 'file GST' }));
    expect(call.ruleId).toBe('overdueTask');
    expect(call.headline).toContain('file GST');
  });

  test('steady fallback always returns a call', () => {
    const call = pickCall(makeInput());
    expect(call.ruleId).toBe('steady');
    expect(call.evidence.length).toBeGreaterThanOrEqual(1);
  });

  test('highest priority wins and the rest appear under alsoConsider', () => {
    const call = pickCall(
      makeInput({
        budgetPace: 1.4,
        overdueUrgentTask: 'file GST',
        projection: {
          shortfallDate: '2026-11-22',
          lowestBalancePaise: -50000,
          shortfallPaise: 50000,
          balanceAfterBillBelowMin: false,
        },
      })
    );
    expect(call.ruleId).toBe('cashflow');
    expect(call.alsoConsider.map((c) => c.ruleId)).toContain('budget');
    expect(call.alsoConsider.map((c) => c.ruleId)).toContain('overdueTask');
  });
});
