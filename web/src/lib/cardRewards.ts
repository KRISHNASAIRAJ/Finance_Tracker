/**
 * cardRewards — reward-point rules per credit card.
 * Mirrors mobile/src/modules/finance/cardRewards.ts so both apps value the
 * same points the same way.
 *
 *  - IDFC (FIRST) style cards: 4 points = ₹1 of reward value.
 *  - Cashback cards: the points are direct cashback (1 pt = ₹1).
 *  - Everything else defaults to 1 pt = ₹1.
 */

export interface CardRewardRule {
  pointsPerRupee: number
  label: string
  directCashback: boolean
}

export const DEFAULT_REWARD_RULE: CardRewardRule = {
  pointsPerRupee: 1,
  label: '1 pt = ₹1',
  directCashback: false,
}

export function cardRewardRule(card: { name?: string | null; bank?: string | null }): CardRewardRule {
  const n = `${card.name ?? ''} ${card.bank ?? ''}`.toLowerCase()
  if (n.includes('idfc')) return { pointsPerRupee: 4, label: '4 pts = ₹1', directCashback: false }
  if (n.includes('cashback')) return { pointsPerRupee: 1, label: '1 pt = ₹1 cashback', directCashback: true }
  return DEFAULT_REWARD_RULE
}

export interface CardRewardValue {
  points: number
  rewardPaise: number
  rule: CardRewardRule
}

export function cardRewardValue(
  card: { name?: string | null; bank?: string | null },
  points?: number | null
): CardRewardValue {
  const p = Number.isFinite(Number(points)) && Number(points) > 0 ? Math.round(Number(points)) : 0
  const rule = cardRewardRule(card)
  const rewardPaise = rule.pointsPerRupee > 0 ? Math.round((p / rule.pointsPerRupee) * 100) : 0
  return { points: p, rewardPaise, rule }
}
