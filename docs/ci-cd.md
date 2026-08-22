# CI/CD Pipeline

Tracend-style pipeline: checks on every PR/push, full backend deploy + signed APK release on every push to `main`.

## Flow

```
PR / push to main, v1, v2  ──►  ci.yml (checks only)
  ├─ smoke:  npm ci → tsc → eslint → expo-doctor → jest
  ├─ deno:   fmt --check + lint on supabase/functions
  ├─ db:     migration timestamp collision check
  └─ OTA:    eas update on main (skips gracefully if EXPO_TOKEN missing)

Push to main  ──►  deploy.yml
  verify → dry-run ┐
         → backup ─┤ (db dump artifact, 14-day retention)
  → deploy-migrations (supabase db push)
  → deploy-functions (matrix: all 10 edge functions)
  → smoke-test (curl health-check, 3 retries)
  → tag-release (auto-tag vYYYY.MM.DD-HHMM)
  → release-apk (calls android-release.yml) → GitHub Release

Manual tag (git tag v1.0.1) or Actions button  ──►  android-release.yml standalone
hotfix.yml  ──►  manual redeploy button (no APK)
dependabot  ──►  weekly npm + github-actions updates
```

Note: GitHub does not trigger workflows from tags pushed with `GITHUB_TOKEN`, so the auto-tag in `deploy.yml` calls `android-release.yml` as a reusable workflow instead of relying on the tag trigger. Manual tags still trigger it directly.

## Branch model

- `main` — production. Checks + full deploy + APK release.
- `v1`, `v2` — sub-main branches. Checks only. Workflows activate on a branch once it contains the workflow files (merge `main` into `v1`/`v2` once after this PR lands).

## Required GitHub secrets

| Secret | Purpose |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI auth (migrations + function deploys) |
| `SUPABASE_DB_PASSWORD` | Database password for `supabase link`/`db push`/`db dump` |
| `ANDROID_KEYSTORE_BASE64` | Release keystore, base64-encoded (`base64 -i meridian.keystore`) |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias inside the keystore |
| `ANDROID_KEY_PASSWORD` | Key password |
| `EXPO_PUBLIC_SUPABASE_URL` | Baked into the APK at build time |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Baked into the APK at build time |
| `EXPO_TOKEN` | (optional) Expo OTA updates; OTA step skips if absent |

## Generate the release keystore (once)

```bash
keytool -genkeypair -v \
  -keystore meridian.keystore \
  -alias meridian \
  -keyalg RSA -keysize 2048 -validity 10000
```

Then store `base64 -i meridian.keystore` as `ANDROID_KEYSTORE_BASE64`. Keep the keystore file safe — losing it means you can no longer update the installed app.

## Releases

- **Automatic:** every push to `main` → deploy chain → auto-tag `vYYYY.MM.DD-HHMM` → signed APK `meridian-<tag>.apk` attached to a GitHub Release. `versionCode` = GitHub run number, `versionName` = tag without the `v` prefix.
- **Manual:** `git tag v1.0.1 && git push origin v1.0.1`, or Actions → Android Release → Run workflow.
- **Hotfix (backend only):** Actions → Hotfix Deploy → Run workflow. Tags `hf-vYYYY.MM.DD-HHMM`, no APK.

## Local development

Nothing changes locally. `build.gradle` release signing falls back to the debug keystore when the signing env vars are absent, so `npx expo run:android` and local release builds keep working.
