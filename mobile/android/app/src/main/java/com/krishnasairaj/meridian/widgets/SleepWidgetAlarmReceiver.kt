package com.krishnasairaj.meridian.widgets

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * SleepWidgetAlarmReceiver — keeps the sleep widgets (and the weather on the
 * clock widget) fresh.
 *
 * It fires from the daily 9:00 AM alarm, from the midnight rollover alarm and
 * from the every-10-minutes interval alarm (SleepWidgetScheduler). Before
 * redrawing, it asks ClockSleepWidget to refresh the realtime weather (at
 * most one Open-Meteo call per 20 minutes, on the stored GPS fix), so the
 * temperature stays live even when the app has not been opened.
 */
class SleepWidgetAlarmReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_REFRESH = "com.krishnasairaj.meridian.widgets.ACTION_SLEEP_WIDGET_REFRESH"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        // The network fetch runs off the main thread; the redraw happens
        // afterwards with whatever reading is available then.
        val pending = goAsync()
        Thread {
            try {
                // Realtime weather — throttled to one fetch per 20 minutes.
                ClockSleepWidget.refreshWeatherBlocking(context)
                SleepStatsWidget.pushUpdate(context)
                ClockSleepWidget.pushUpdate(context)
                // Re-arm the alarm (a reboot clears it).
                SleepWidgetScheduler.schedule(context)
            } catch (e: Exception) {
                /* best-effort — the alarm must never crash */
            } finally {
                pending.finish()
            }
        }.start()
    }
}
