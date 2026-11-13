package com.krishnasairaj.meridian.sleep

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

/**
 * SleepMotionScheduler — WHEN the automatic tracker may run.
 *
 * The tracker is a NIGHT service: it only samples the accelerometer inside
 * the night window (21:30 → 09:30 by default). During the day it does not run
 * at all — no foreground service, no "Sleep tracking" notification, no battery
 * drain and nothing polluting the sleep timeline.
 *
 * When the window opens an exact alarm wakes the tracker up; when the window
 * closes the tracker stops itself and arms the next night.
 */
object SleepMotionScheduler {

    /** The broadcast that starts the tracker when the night window opens. */
    const val ACTION_START = "com.krishnasairaj.meridian.sleep.action.START"

    private const val REQUEST_CODE = 4200

    /** The minute of the local day (0 … 1439). */
    fun minutesOfDay(ts: Long = System.currentTimeMillis()): Int {
        val cal = Calendar.getInstance()
        cal.timeInMillis = ts
        return cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
    }

    /** Is this minute of the day inside the night window? */
    fun isInNightWindow(config: SleepMotionConfig, minute: Int): Boolean {
        val m = ((minute % 1440) + 1440) % 1440
        val s = ((config.sleepStartMin % 1440) + 1440) % 1440
        val e = ((config.sleepEndMin % 1440) + 1440) % 1440
        // A zero-length window means "always".
        if (s == e) return true
        return if (s < e) m >= s && m <= e else m >= s || m <= e
    }

    /** Is the tracker allowed to run right now? */
    fun isTrackingTime(config: SleepMotionConfig, ts: Long = System.currentTimeMillis()): Boolean =
        isInNightWindow(config, minutesOfDay(ts))

    /**
     * The minutes until the night window opens — 0 when it is already open.
     * Used to retry shortly instead of skipping the night.
     */
    fun minutesUntilWindow(
        config: SleepMotionConfig,
        ts: Long = System.currentTimeMillis()
    ): Int {
        if (isTrackingTime(config, ts)) return 0
        val now = minutesOfDay(ts)
        val start = ((config.sleepStartMin % 1440) + 1440) % 1440
        return (start - now + 1440) % 1440
    }

    /** The next time the night window opens (epoch ms). */
    fun nextWindowStart(config: SleepMotionConfig, from: Long = System.currentTimeMillis()): Long {
        val cal = Calendar.getInstance()
        cal.timeInMillis = from
        cal.set(Calendar.HOUR_OF_DAY, (config.sleepStartMin / 60).coerceIn(0, 23))
        cal.set(Calendar.MINUTE, (config.sleepStartMin % 60).coerceIn(0, 59))
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        if (cal.timeInMillis <= from) cal.add(Calendar.DAY_OF_YEAR, 1)
        return cal.timeInMillis
    }

    /** Arm the alarm that starts the tracker when the window opens. */
    fun scheduleStart(context: Context, config: SleepMotionConfig) {
        scheduleStartAt(context, nextWindowStart(config))
    }

    /**
     * Arm the start alarm for a given moment.
     *
     * This is also the retry path: when the system refuses to start the
     * tracker (a background foreground-service start), the tracker is armed
     * again in a few minutes instead of waiting for the next night.
     */
    fun scheduleStartAt(context: Context, atMillis: Long) {
        try {
            val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val pending = pendingIntent(context)
            try {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pending)
            } catch (e: SecurityException) {
                // Android 12+ can revoke the exact-alarm permission — fall back
                // to an inexact alarm (a few minutes late is still fine).
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pending)
            }
        } catch (e: Exception) {
            /* best-effort */
        }
    }

    /**
     * Try again in a few minutes — the night must not be lost because one
     * start was refused.
     */
    fun scheduleRetry(context: Context, minutes: Int = 10) {
        val at = System.currentTimeMillis() + minutes.coerceAtLeast(1) * 60_000L
        scheduleStartAt(context, at)
    }

    /** Is the retry still inside the night window? */
    fun isStillNight(config: SleepMotionConfig): Boolean =
        isTrackingTime(config)

    /** Cancel the pending start alarm. */
    fun cancelStart(context: Context) {
        try {
            val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            am.cancel(pendingIntent(context))
        } catch (e: Exception) {
            /* ignore */
        }
    }

    private fun pendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, SleepMotionAlarmReceiver::class.java).setAction(ACTION_START)
        return PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
