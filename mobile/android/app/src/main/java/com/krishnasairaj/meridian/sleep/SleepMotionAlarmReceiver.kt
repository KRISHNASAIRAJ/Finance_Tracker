package com.krishnasairaj.meridian.sleep

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * SleepMotionAlarmReceiver — handles the smart-alarm notification buttons.
 *
 *   Stop              → stop ringing (the alarm stays "fired" for the day)
 *   Snooze N min      → stop ringing and ring again in N minutes
 *   Stop tracking     → stop the whole tracker
 */
class SleepMotionAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        try {
            when (action) {
                SleepMotionService.ACTION_STOP_ALARM -> {
                    SleepMotionService.instance?.stopAlarm(false)
                }
                SleepMotionService.ACTION_SNOOZE_ALARM -> {
                    SleepMotionService.instance?.stopAlarm(true)
                }
                SleepMotionService.ACTION_STOP_TRACKING -> {
                    SleepMotionService.instance?.stopTracking()
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
}
