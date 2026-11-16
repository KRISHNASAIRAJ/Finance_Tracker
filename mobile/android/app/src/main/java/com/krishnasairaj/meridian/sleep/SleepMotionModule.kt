package com.krishnasairaj.meridian.sleep

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/**
 * SleepMotionModule — JS entry point for the automatic sleep tracker.
 *
 * The heavy lifting happens in SleepMotionService (a foreground service that
 * samples the accelerometer). This module only starts/stops it and hands the
 * recorded timeline (one bucket per minute) to JS, where the sleep session is
 * inferred (see mobile/src/modules/sleep/sleepInference.ts).
 */
class SleepMotionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SleepMotion"

    /** The tracker is Android-only; JS uses this to hide the UI elsewhere. */
    @ReactMethod
    fun isAvailable(promise: Promise) {
        promise.resolve(true)
    }

    /** Start (or restart) the tracker with the given settings. */
    @ReactMethod
    fun start(config: ReadableMap?, promise: Promise) {
        try {
            val current = SleepMotionStore.loadConfig(reactApplicationContext)
            val cfg = SleepMotionConfig.fromMap(config).copy(
                enabled = true,
                manualBedtimeMs = current.manualBedtimeMs
            )
            SleepMotionStore.saveConfig(reactApplicationContext, cfg)
            // NIGHT ONLY: during the day the tracker waits for tonight — the
            // service is never started, so there is no notification all day.
            if (SleepMotionScheduler.isTrackingTime(cfg)) {
                startTrackerService()
            } else {
                SleepMotionScheduler.scheduleStart(reactApplicationContext, cfg)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_START_FAILED", e.message ?: "start failed", e)
        }
    }

    /** Start the foreground service that samples the accelerometer. */
    private fun startTrackerService() {
        try {
            val intent = Intent(reactApplicationContext, SleepMotionService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
        } catch (e: Exception) {
            /* ignore */
        }
    }

    /**
     * "Going to bed" was tapped at `bedtimeMs`: begin tracking immediately,
     * even if that is earlier than the configured night window. The bedtime is
     * remembered so JS can use it as the sleep session's start and so the night
     * is not confined to the 21:30 window that was never actually used.
     */
    @ReactMethod
    fun startAt(bedtimeMs: Double, config: ReadableMap?, promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val cfg = SleepMotionConfig.fromMap(config).copy(manualBedtimeMs = bedtimeMs.toLong())
            SleepMotionStore.saveConfig(ctx, cfg)
            // We are starting now — the scheduled "window opens" alarm is moot.
            SleepMotionScheduler.cancelStart(ctx)
            startTrackerService()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_START_AT_FAILED", e.message ?: "start at failed", e)
        }
    }

    /**
     * "Good morning" (or a cancelled bedtime): end the manual night. Clears the
     * bedtime override, stops the sensor and re-arms the passive nightly start
     * if the user still has Automatic tracking enabled.
     */
    @ReactMethod
    fun endManualNight(promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val cleared = SleepMotionStore.loadConfig(ctx).copy(manualBedtimeMs = 0L)
            SleepMotionStore.saveConfig(ctx, cleared)
            try {
                ctx.stopService(Intent(ctx, SleepMotionService::class.java))
            } catch (e: Exception) {
                /* ignore */
            }
            if (cleared.enabled) SleepMotionScheduler.scheduleStart(ctx, cleared)
            else SleepMotionScheduler.cancelStart(ctx)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_END_NIGHT_FAILED", e.message ?: "end night failed", e)
        }
    }

    /** Stop the tracker (the settings are kept). */
    @ReactMethod
    fun stop(promise: Promise) {
        try {
            val cfg = SleepMotionStore.loadConfig(reactApplicationContext).copy(
                enabled = false,
                manualBedtimeMs = 0L
            )
            SleepMotionStore.saveConfig(reactApplicationContext, cfg)
            // The pending "start tonight" alarm goes away too.
            SleepMotionScheduler.cancelStart(reactApplicationContext)
            try {
                reactApplicationContext.stopService(
                    Intent(reactApplicationContext, SleepMotionService::class.java)
                )
            } catch (e: Exception) {
                /* ignore */
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_STOP_FAILED", e.message ?: "stop failed", e)
        }
    }

    /** Update the settings without restarting the tracker. */
    @ReactMethod
    fun setConfig(config: ReadableMap?, promise: Promise) {
        try {
            val current = SleepMotionStore.loadConfig(reactApplicationContext)
            val incoming = SleepMotionConfig.fromMap(config)
            // Only the enabled flag and an in-progress manual bedtime are owned
            // by the service lifecycle — a settings change must not clear a
            // night that is already underway.
            val merged = incoming.copy(
                enabled = current.enabled,
                manualBedtimeMs = current.manualBedtimeMs
            )
            SleepMotionStore.saveConfig(reactApplicationContext, merged)
            // A new night window → re-arm the start (the old alarm would fire
            // at the wrong time).
            if (merged.enabled && !SleepMotionScheduler.isTrackingTime(merged)) {
                SleepMotionScheduler.scheduleStart(reactApplicationContext, merged)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_CONFIG_FAILED", e.message ?: "config failed", e)
        }
    }

    /** Current tracker status + settings. */
    @ReactMethod
    fun getStatus(promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val config = SleepMotionStore.loadConfig(ctx)
            val map: WritableMap = Arguments.createMap()
            map.putBoolean("running", SleepMotionService.instance != null)
            map.putDouble("startedAt", SleepMotionStore.startedAt(ctx).toDouble())
            map.putDouble("lastSampleAt", SleepMotionStore.lastSampleAt(ctx).toDouble())
            map.putDouble("lastMovementAt", SleepMotionStore.lastMovementAt(ctx).toDouble())
            map.putDouble("stillSince", SleepMotionStore.stillSince(ctx).toDouble())
            map.putBoolean("alarmActive", SleepMotionService.instance?.isAlarmActive() ?: false)
            map.putMap("config", configToMap(config))
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("E_STATUS_FAILED", e.message ?: "status failed", e)
        }
    }

    /**
     * The motion timeline: one entry per minute
     * { m: epochMinute, v: peak movement, s: seconds of sustained movement,
     *   o: seconds the screen was interactive }.
     */
    @ReactMethod
    fun getBuckets(promise: Promise) {
        try {
            val buckets = SleepMotionStore.loadBuckets(reactApplicationContext)
            val arr: WritableArray = Arguments.createArray()
            for (b in buckets) {
                val item: WritableMap = Arguments.createMap()
                item.putDouble("m", b.minute.toDouble())
                item.putDouble("v", b.value.toDouble())
                item.putInt("s", b.movingSeconds)
                item.putInt("o", b.screenOnSeconds)
                arr.pushMap(item)
            }
            promise.resolve(arr)
        } catch (e: Exception) {
            promise.reject("E_BUCKETS_FAILED", e.message ?: "buckets failed", e)
        }
    }

    /** Delete the recorded timeline. */
    @ReactMethod
    fun clearBuckets(promise: Promise) {
        try {
            SleepMotionStore.clearBuckets(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_CLEAR_FAILED", e.message ?: "clear failed", e)
        }
    }

    /** Silence a ringing alarm (from the app). */
    @ReactMethod
    fun stopAlarm(promise: Promise) {
        try {
            SleepMotionService.instance?.stopAlarm(false)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_ALARM_FAILED", e.message ?: "alarm failed", e)
        }
    }

    private fun configToMap(config: SleepMotionConfig): WritableMap {
        val map: WritableMap = Arguments.createMap()
        map.putBoolean("enabled", config.enabled)
        map.putString("sensitivity", config.sensitivity)
        map.putInt("sleepStartMin", config.sleepStartMin)
        map.putInt("sleepEndMin", config.sleepEndMin)
        map.putBoolean("alarmEnabled", config.alarmEnabled)
        map.putString("alarmMode", config.alarmMode)
        map.putInt("wakeStartMin", config.wakeStartMin)
        map.putInt("wakeEndMin", config.wakeEndMin)
        map.putInt("alarmDurationMin", config.alarmDurationMin)
        map.putInt("snoozeMin", config.snoozeMin)
        map.putBoolean("autoSave", config.autoSave)
        map.putBoolean("morningBanner", config.morningBanner)
        map.putDouble("manualBedtimeMs", config.manualBedtimeMs.toDouble())
        return map
    }
}
