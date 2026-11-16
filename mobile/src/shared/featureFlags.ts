/**
 * Feature flags for additive work.
 *
 * The decision-first layer (Today card, Why timeline, and later Simulator,
 * Proposals, Coverage, Ask Meridian and Privacy) is gated by one flag.
 * Flip DECISION_LAYER_ENABLED to false to hide every one of those surfaces
 * without touching any existing screen logic.
 *
 * Later tiers may read an AsyncStorage / user_settings override here; until
 * then this single constant is the switch.
 */
export const DECISION_LAYER_ENABLED = true;
