package com.krishnasairaj.meridian.widgets

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * ClockSleepWidgetBridge — JS entry point for the Clock + Sleep home-screen
 * widget. The app pushes a compact sleep payload (see
 * mobile/src/services/sleepWidget.ts); the widget renders it from
 * SharedPreferences on every redraw.
 */
class ClockSleepWidgetBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ClockSleepWidgetBridge"

    @ReactMethod
    fun setSleep(json: String?, promise: Promise) {
        try {
            ClockSleepWidget.setSleep(reactApplicationContext, json ?: "")
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_SLEEP_WIDGET_WRITE", e.message ?: "write failed", e)
        }
    }
}
