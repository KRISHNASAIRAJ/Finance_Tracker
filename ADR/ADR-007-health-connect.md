# ADR-007: Android Health Connect Over Google Fit(Lets consider this as last priority we may or may not implement this one for now ignore this just now I have decided and took this decision)
## Status: Accepted · Date: 2026-07-17

## Context
Google Fit APIs are being deprecated and will stop functioning at the end of 2026. The successor is Android Health Connect, which provides a unified health data platform.

## Decision
**Use Android Health Connect API exclusively for fitness data. Do not import or reference Google Fit APIs anywhere in the codebase.**

## Impact on Fitness Widget (Phase 8)
- Library: `react-native-health-connect` (community library wrapping Health Connect APIs)
- Permission: `android.permission.health.READ_STEPS` (declared in AndroidManifest.xml)
- Data type: `StepsRecord` (daily aggregated step count)
- Sync frequency: On app open + background sync every 4 hours max (battery consideration)

## iOS Note
iOS uses HealthKit (not Health Connect). Since iOS support is deferred to post-v1, do not write any HealthKit code. The fitness feature is Android-only in v1. Any shared fitness service file must have an Android-only guard.

## Consequences
- `react-native-health-connect` minimum Android API level: 26 (Android 8.0)
- Health Connect app must be installed on the user's device (comes pre-installed on Android 14+)
- Do not cache Health Connect data for more than 24 hours — always re-fetch for current step counts
