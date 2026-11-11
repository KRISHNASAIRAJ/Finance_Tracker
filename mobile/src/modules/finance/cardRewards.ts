/**
 * cardRewards — reward-point rules per credit card.
 *
 * Different cards redeem points differently:
 *  - IDFC (FIRST) style cards: 4 points = ₹1 of reward value.
 *  - SBI Cashback style cards: the points are direct cashback (1 pt = ₹1).
 *  - Everything else defaults to 1 pt = ₹1, which is the common case for
 *    Indian reward programs.
 *
 * The rule is matched on the card name (and bank), so it works for cards
 * added manually or synced from the cloud.
 */

export interface CardRewardRule {
  /** How many points are needed for ₹1 of reward value */
  pointsPerRupee: number;
  /** Short label shown next to the value, e.g. "4 pts = ₹1" */
  label: string;
  /** True when the points are redeemed directly as cashback */
  directCashback: boolean;
}

export const DEFAULT_REWARD_RULE: CardRewardRule = {
  pointsPerRupee: 1,
  label: '1 pt = ₹1',
  directCashback: false,
};

export function cardRewardRule(card: { name?: string; bank?: string }): CardRewardRule {
  const n = `${card.name ?? ''} ${card.bank ?? ''}`.toLowerCase();
  if (n.includes('idfc')) {
    return { pointsPerRupee: 4, label: '4 pts = ₹1', directCashback: false };
  }
  if (n.includes('cashback')) {
    return { pointsPerRupee: 1, label: '1 pt = ₹1 cashback', directCashback: true };
  }
  return DEFAULT_REWARD_RULE;
}

export interface CardRewardValue {
  /** Points collected on the card */
  points: number;
  /** What those points are worth, in paise */
  rewardPaise: number;
  rule: CardRewardRule;
}

/** Points on a card and what they are worth. */
export function cardRewardValue(
  card: { name?: string; bank?: string },
  points?: number | null
): CardRewardValue {
  const p = Number.isFinite(Number(points)) && Number(points) > 0 ? Math.round(Number(points)) : 0;
  const rule = cardRewardRule(card);
  const rewardPaise = rule.pointsPerRupee > 0 ? Math.round((p / rule.pointsPerRupee) * 100) : 0;
  return { points: p, rewardPaise, rule };
}
