package com.krishnasairaj.meridian.sleep

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * SleepDetectModule — reads UsageStatsManager screen-on/off events to infer
 * the longest overnight quiet gap (bedtime -> wake time). Purely passive:
 * queried on demand when the app opens; no background service, no battery use.
 */
class SleepDetectModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "SleepDetect"

  private fun hasUsageAccess(): Boolean {
    val ctx: Context = reactApplicationContext
    return try {
      val appOps = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      // checkOpNoThrow works on all supported API levels (24+).
      // unsafeCheckOpNoThrow would need API 30+.
      @Suppress("DEPRECATION")
      val mode = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        ctx.packageName
      )
      mode == AppOpsManager.MODE_ALLOWED
    } catch (e: Exception) {
      false
    }
  }

  /**
   * Returns whether the user has granted "Usage access" to the app.
   */
  @ReactMethod
  fun hasPermission(promise: Promise) {
    try {
      promise.resolve(hasUsageAccess())
    } catch (e: Exception) {
      promise.reject("E_CHECK_FAILED", e.message ?: "check failed", e)
    }
  }

  /**
   * Open the system "Usage access" settings screen so the user can grant
   * access to this app.
   */
  @ReactMethod
  fun openSettings(promise: Promise) {
    try {
      try {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.startActivity(intent)
        promise.resolve(true)
      } catch (e: Exception) {
        // Some OEM builds block ACTION_USAGE_ACCESS_SETTINGS for sideloaded
        // apps ("App was denied access"). Fall back to this app's details
        // page, where the user can use the (⋮) menu -> "Allow restricted
        // settings" to unblock the Usage access toggle.
        val details = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
          .setData(android.net.Uri.parse("package:" + reactApplicationContext.packageName))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.startActivity(details)
        promise.resolve(true)
      }
    } catch (e: Exception) {
      promise.reject("E_OPEN_FAILED", e.message ?: "open failed", e)
    }
  }

  /**
   * Detect last night's sleep window from screen-usage events.
   *
   * Algorithm:
   *  - Query UsageEvents over the last 36 hours
   *  - Collect foreground-resume timestamps (screen in use)
   *  - The longest gap (>= minGapMs) between consecutive usage events that
   *    ended within the last 16 hours is the sleep window
   *  - Return { bedTime, wakeTime, interruptions } as epoch ms
   */
  @ReactMethod
  fun detectLastSleep(minGapMs: Double, promise: Promise) {
    if (!hasUsageAccess()) {
      promise.reject("E_NO_PERMISSION", "Usage access not granted")
      return
    }
    try {
      val usm = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE)
        as UsageStatsManager
      val now = System.currentTimeMillis()
      val start = now - 36L * 3_600_000L // 36h window
      val events = usm.queryEvents(start, now)

      val screenOns = ArrayList<Long>()
      val ev = UsageEvents.Event()
      while (events.hasNextEvent()) {
        events.getNextEvent(ev)
        // ACTIVITY_RESUMED == MOVE_TO_FOREGROUND == 1 (renamed in API 29;
        // the constant value is identical and inlined at compile time, so
        // this works on every supported API level).
        if (ev.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
          screenOns.add(ev.timeStamp)
        }
      }
      if (screenOns.size < 2) {
        promise.reject("E_NO_DATA", "Not enough usage events")
        return
      }

      val minGap = if (minGapMs > 0) minGapMs.toLong() else 3L * 3_600_000L

      // Find the longest gap between consecutive screen-on events that
      // ended within the last 16 hours (i.e., last night, not days ago).
      var bedTime = -1L
      var wakeTime = -1L
      var bestGap = 0L
      val cutoff = now - 16L * 3_600_000L
      for (i in 0 until screenOns.size - 1) {
        val gapStart = screenOns[i]
        val gapEnd = screenOns[i + 1]
        val gap = gapEnd - gapStart
        if (gap >= minGap && gapEnd >= cutoff && gap > bestGap) {
          bestGap = gap
          bedTime = gapStart
          wakeTime = gapEnd
        }
      }
      if (bedTime < 0) {
        promise.reject("E_NO_SLEEP", "No qualifying overnight gap found")
        return
      }

      // Interruptions: screen-ons strictly inside the sleep window
      // (brief wakes during the night).
      var interruptions = 0
      for (t in screenOns) {
        if (t > bedTime && t < wakeTime) interruptions++
      }

      val result = Arguments.createMap()
      result.putDouble("bedTime", bedTime.toDouble())
      result.putDouble("wakeTime", wakeTime.toDouble())
      result.putInt("interruptions", interruptions)
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("E_DETECT_FAILED", e.message ?: "detect failed", e)
    }
  }
}
