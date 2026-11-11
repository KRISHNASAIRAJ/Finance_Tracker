package com.krishnasairaj.meridian.widgets

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * StatsWidgetBridge — JS entry point for the home-screen Stats widget.
 * The app pushes a compact daily-stats JSON snapshot (see
 * mobile/src/services/statsWidget.ts); the widget renders it from
 * SharedPreferences on every redraw.
 */
class StatsWidgetBridgeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "StatsWidgetBridge"

  @ReactMethod
  fun setStats(json: String?, promise: Promise) {
    try {
      StatsWidget.setStats(reactApplicationContext, json ?: "")
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_STATS_WRITE", e.message ?: "write failed", e)
    }
  }
}
