package com.krishnasairaj.meridian.widgets

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * SleepWidgetAlarmReceiver — redraws the sleep widgets.
 *
 * It fires from the daily 9:00 AM alarm (SleepWidgetScheduler) and after a
 * reboot (the alarm does not survive one). The widget data itself is pushed
 * from JS, so the refresh only re-renders the last known night.
 */
class SleepWidgetAlarmReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_REFRESH = "com.krishnasairaj.meridian.widgets.ACTION_SLEEP_WIDGET_REFRESH"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        try {
            SleepStatsWidget.pushUpdate(context)
            ClockSleepWidget.pushUpdate(context)
            // Re-arm the alarm (a reboot clears it).
            SleepWidgetScheduler.schedule(context)
        } catch (e: Exception) {
            /* best-effort */
        }
    }
}
