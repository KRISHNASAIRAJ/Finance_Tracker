package com.krishnasairaj.meridian.sleep

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * SleepMotionBootReceiver — restarts the tracker after a reboot so overnight
 * tracking does not need the user to open the app again.
 */
class SleepMotionBootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != "android.intent.action.QUICKBOOT_POWERON" &&
            action != "com.htc.intent.action.QUICKBOOT_POWERON"
        ) {
            return
        }
        try {
            val config = SleepMotionStore.loadConfig(context)
            if (!config.enabled) return
            // NIGHT ONLY: after a reboot during the day the tracker waits for
            // tonight instead of running (and showing its notification) all
            // day.
            if (!SleepMotionScheduler.isTrackingTime(config)) {
                SleepMotionScheduler.scheduleStart(context, config)
                return
            }
            val serviceIntent = Intent(context, SleepMotionService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        } catch (e: Exception) {
            /* ignore */
        }
    }
}
