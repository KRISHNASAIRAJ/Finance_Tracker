package com.krishnasairaj.meridian.widgets

import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * KwgtBridgeModule — sends the sleep data to KWGT (the Kustom widget maker).
 *
 * A KWGT widget can receive a broadcast and read the extras, so the same
 * night that the Meridian widget draws (the duration, the score, the bed and
 * the wake time) can be shown in a KWGT preset too.
 *
 * The broadcast:
 *   action  com.meridian.sleep.WIDGET_DATA
 *   package org.kustom.widget
 *   extra   data — the JSON payload
 */
class KwgtBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "KwgtBridge"

    /** Send the sleep payload to KWGT. */
    @ReactMethod
    fun sendSleepData(json: String, promise: Promise) {
        try {
            val intent = Intent(ACTION_WIDGET_DATA)
            // Only KWGT receives it.
            intent.setPackage(KWGT_PACKAGE)
            intent.putExtra(EXTRA_DATA, json)
            reactApplicationContext.sendBroadcast(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_KWGT_SEND", e.message ?: "could not send the data", e)
        }
    }

    companion object {
        const val ACTION_WIDGET_DATA = "com.meridian.sleep.WIDGET_DATA"
        const val EXTRA_DATA = "data"
        const val KWGT_PACKAGE = "org.kustom.widget"
    }
}
