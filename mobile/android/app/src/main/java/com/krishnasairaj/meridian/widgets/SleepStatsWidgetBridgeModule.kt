package com.krishnasairaj.meridian.widgets

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * SleepStatsWidgetBridge — JS entry point for the sleep-only 2x2 home-screen
 * widget. The app pushes a compact sleep payload (see
 * mobile/src/services/sleepWidget.ts); the widget renders it from
 * SharedPreferences on every redraw.
 */
class SleepStatsWidgetBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SleepStatsWidgetBridge"

    @ReactMethod
    fun setSleep(json: String?, promise: Promise) {
        try {
            SleepStatsWidget.setSleep(reactApplicationContext, json ?: "")
            // Keep the daily 9:00 AM refresh armed.
            SleepWidgetScheduler.schedule(reactApplicationContext)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_SLEEP_STATS_WIDGET_WRITE", e.message ?: "write failed", e)
        }
    }
}
