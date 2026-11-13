package com.krishnasairaj.meridian.widgets

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * StatsWidgetActionReceiver — the widget's own actions.
 *
 * Tapping the stats widget goes to the next screen: that cannot be a
 * PendingIntent (a PendingIntent can only open something), so it is a
 * broadcast that the widget's own receiver handles.
 */
class StatsWidgetActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        try {
            when (action) {
                ACTION_NEXT -> StatsWidget.nextScreen(context)
            }
        } catch (e: Exception) {
            /* ignore */
        }
    }

    companion object {
        const val ACTION_NEXT = "com.meridian.stats.NEXT"
    }
}
