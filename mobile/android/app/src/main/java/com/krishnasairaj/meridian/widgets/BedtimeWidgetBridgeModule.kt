package com.krishnasairaj.meridian.widgets

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * BedtimeWidgetBridge — exposes the BedtimeWidget's pending-bedtime state
 * (SharedPreferences) to JS so the app and the home-screen widget show the
 * same session.
 */
class BedtimeWidgetBridgeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "BedtimeWidgetBridge"

  @ReactMethod
  fun getPendingStart(promise: Promise) {
    try {
      promise.resolve(BedtimeWidget.getPendingStart(reactApplicationContext) ?: 0.0)
    } catch (e: Exception) {
      promise.reject("E_BEDTIME_READ", e.message ?: "read failed", e)
    }
  }

  /**
   * An ended-but-unlogged session {start, end} (epoch ms), or null. Fallback
   * so a widget "good morning" tap is never lost if the deep link fails.
   */
  @ReactMethod
  fun getEndedSession(promise: Promise) {
    try {
      val session = BedtimeWidget.getEndedSession(reactApplicationContext)
      if (session == null) {
        promise.resolve(null)
      } else {
        val map = Arguments.createMap()
        map.putDouble("start", session.first.toDouble())
        map.putDouble("end", session.second.toDouble())
        promise.resolve(map)
      }
    } catch (e: Exception) {
      promise.reject("E_BEDTIME_READ", e.message ?: "read failed", e)
    }
  }

  /** Set the pending start; null clears both the active session and any ended marker. */
  @ReactMethod
  fun setPendingStart(startMs: Double?, promise: Promise) {
    try {
      val start = if (startMs != null && startMs > 0) startMs.toLong() else null
      BedtimeWidget.setPendingStart(reactApplicationContext, start)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_BEDTIME_WRITE", e.message ?: "write failed", e)
    }
  }
}
