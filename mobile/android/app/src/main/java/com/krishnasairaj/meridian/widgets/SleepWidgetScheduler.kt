package com.krishnasairaj.meridian.widgets

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

/**
 * SleepWidgetScheduler — refreshes the sleep widgets every day at 9:00 AM.
 *
 * The widget shows the last night, so a morning refresh (after the user got
 * up) is what makes the number correct. The alarm is re-armed on boot and
 * whenever the widget is drawn, so it survives a reboot.
 */
object SleepWidgetScheduler {

    /** The daily refresh — 9:00 AM. */
    const val REFRESH_HOUR = 9
    const val REFRESH_MINUTE = 0

    private const val REQUEST_CODE = 4711

    /** Arm (or re-arm) the daily 9:00 AM refresh. Safe to call repeatedly. */
    fun schedule(context: Context) {
        try {
            val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, SleepWidgetAlarmReceiver::class.java).apply {
                action = SleepWidgetAlarmReceiver.ACTION_REFRESH
            }
            val pending = PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val next = nextRun()
            // An inexact repeating alarm is enough for a widget refresh and it
            // costs no battery.
            am.setInexactRepeating(
                AlarmManager.RTC_WAKEUP,
                next,
                AlarmManager.INTERVAL_DAY,
                pending
            )
        } catch (e: Exception) {
            /* best-effort */
        }
    }

    /** Cancel the daily refresh. */
    fun cancel(context: Context) {
        try {
            val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, SleepWidgetAlarmReceiver::class.java).apply {
                action = SleepWidgetAlarmReceiver.ACTION_REFRESH
            }
            val pending = PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            am.cancel(pending)
        } catch (e: Exception) {
            /* best-effort */
        }
    }

    /** The next 9:00 AM (epoch ms). */
    fun nextRun(now: Long = System.currentTimeMillis()): Long {
        val cal = Calendar.getInstance()
        cal.timeInMillis = now
        cal.set(Calendar.HOUR_OF_DAY, REFRESH_HOUR)
        cal.set(Calendar.MINUTE, REFRESH_MINUTE)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        if (cal.timeInMillis <= now) cal.add(Calendar.DAY_OF_YEAR, 1)
        return cal.timeInMillis
    }
}
