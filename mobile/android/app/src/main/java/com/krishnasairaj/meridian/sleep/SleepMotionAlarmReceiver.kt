package com.krishnasairaj.meridian.sleep

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * SleepMotionAlarmReceiver — handles the smart-alarm notification buttons and
 * the "the night window opened" alarm.
 *
 *   Start (alarm)      → the night window opened: start the tracker
 *   Stop              → stop ringing (the alarm stays "fired" for the day)
 *   Snooze N min      → stop ringing and ring again in N minutes
 *   Stop tracking     → stop the whole tracker
 */
class SleepMotionAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        try {
            when (action) {
                SleepMotionScheduler.ACTION_START -> {
                    startTracker(context)
                }
                SleepMotionService.ACTION_STOP_ALARM -> {
                    SleepMotionService.instance?.stopAlarm(false)
                }
                SleepMotionService.ACTION_SNOOZE_ALARM -> {
                    SleepMotionService.instance?.stopAlarm(true)
                }
                SleepMotionService.ACTION_STOP_TRACKING -> {
                    SleepMotionService.instance?.stopTracking()
                    SleepMotionScheduler.cancelStart(context)
                    try {
                        context.stopService(Intent(context, SleepMotionService::class.java))
                    } catch (e: Exception) {
                        /* ignore */
                    }
                }
            }
        } catch (e: Exception) {
            /* ignore */
        }
    }

    /** The night window opened — start the foreground tracker. */
    private fun startTracker(context: Context) {
        var config: SleepMotionConfig? = null
        try {
            config = SleepMotionStore.loadConfig(context)
            if (!config.enabled) return
            // The window may have moved since the alarm was armed — if it has
            // not opened yet, try again shortly instead of skipping the night.
            if (!SleepMotionScheduler.isTrackingTime(config)) {
                SleepMotionScheduler.scheduleRetry(context, 10)
                return
            }
            val intent = Intent(context, SleepMotionService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (e: Exception) {
            // The system may refuse a background foreground-service start.
            // Try again in a few minutes — the night must not be lost.
            try {
                val cfg = config ?: SleepMotionStore.loadConfig(context)
                if (cfg.enabled && SleepMotionScheduler.isStillNight(cfg)) {
                    SleepMotionScheduler.scheduleRetry(context, 10)
                } else {
                    SleepMotionScheduler.scheduleStart(context, cfg)
                }
            } catch (e2: Exception) {
                /* ignore */
            }
        }
    }
}
