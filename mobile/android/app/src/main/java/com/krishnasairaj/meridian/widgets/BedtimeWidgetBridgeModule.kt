package com.krishnasairaj.meridian.widgets

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

  @ReactMethod
  fun setPendingStart(startMs: Double, promise: Promise) {
    try {
      val start = if (startMs > 0) startMs.toLong() else null
      BedtimeWidget.setPendingStart(reactApplicationContext, start)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_BEDTIME_WRITE", e.message ?: "write failed", e)
    }
  }
}
