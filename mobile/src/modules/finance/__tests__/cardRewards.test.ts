/**
 * Card reward rules — points are valued per card program:
 * IDFC style cards are 4 points = ₹1, cashback cards are 1 point = ₹1.
 */
import { cardRewardRule, cardRewardValue } from '../cardRewards';

describe('cardRewardRule', () => {
  it('uses 4 points = ₹1 for IDFC cards', () => {
    const rule = cardRewardRule({ name: 'IDFC FIRST' });
    expect(rule.pointsPerRupee).toBe(4);
    expect(rule.directCashback).toBe(false);
  });

  it('treats cashback cards as direct cashback (1 pt = ₹1)', () => {
    const rule = cardRewardRule({ name: 'SBI Cashback' });
    expect(rule.pointsPerRupee).toBe(1);
    expect(rule.directCashback).toBe(true);
  });

  it('falls back to 1 point = ₹1 for other cards', () => {
    const rule = cardRewardRule({ name: 'HDFC Millennia' });
    expect(rule.pointsPerRupee).toBe(1);
    expect(rule.directCashback).toBe(false);
  });

  it('also matches on the bank name', () => {
    expect(cardRewardRule({ name: 'My Card', bank: 'IDFC' }).pointsPerRupee).toBe(4);
  });
});

describe('cardRewardValue', () => {
  it('values IDFC points at a quarter rupee each', () => {
    const { points, rewardPaise } = cardRewardValue({ name: 'IDFC FIRST' }, 12400);
    expect(points).toBe(12400);
    expect(rewardPaise).toBe(310000); // ₹3,100
  });

  it('values cashback points one to one', () => {
    const { points, rewardPaise, rule } = cardRewardValue({ name: 'SBI Cashback' }, 8200);
    expect(points).toBe(8200);
    expect(rewardPaise).toBe(820000); // ₹8,200
    expect(rule.directCashback).toBe(true);
  });

  it('handles missing or invalid points', () => {
    expect(cardRewardValue({ name: 'IDFC FIRST' }).points).toBe(0);
    expect(cardRewardValue({ name: 'IDFC FIRST' }, NaN).rewardPaise).toBe(0);
    expect(cardRewardValue({ name: 'IDFC FIRST' }, -50).points).toBe(0);
  });

  it('rounds the reward value to whole paise', () => {
    // 10 points on an IDFC card = ₹2.50
    expect(cardRewardValue({ name: 'IDFC FIRST' }, 10).rewardPaise).toBe(250);
  });
});
