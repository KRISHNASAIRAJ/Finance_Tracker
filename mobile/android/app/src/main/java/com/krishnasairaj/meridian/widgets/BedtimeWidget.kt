package com.krishnasairaj.meridian.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.krishnasairaj.meridian.MainActivity
import com.krishnasairaj.meridian.R

/**
 * BedtimeWidget — tap to mark "going to bed" (start), tap again to mark
 * "good morning" (stop). The widget itself is stateless; the pending bedtime
 * timestamp is persisted in SharedPreferences so it survives widget redraws,
 * process death, and is readable from JS (SleepWidgetBridge).
 *
 * Tap 1: writes start time, label flips to "TAP WAKE UP", starts ticking elapsed time.
 * Tap 2: computes duration, broadcasts to the app (deep link with start/end),
 *        resets state.
 *
 * Long-press or elapsed > 24h safety: auto-resets (treats as abandoned session).
 */
private const val ACTION_TOGGLE = "com.krishnasairaj.meridian.widgets.ACTION_BEDTIME_TOGGLE"

class BedtimeWidget : AppWidgetProvider() {

    companion object {
        const val PREFS = "meridian_bedtime_widget"
        const val KEY_START = "bedtime_start_ms"
        const val MAX_SESSION_MS = 24 * 60 * 60 * 1000L  // 24h cap

        /** Read the pending bedtime start (epoch ms), or null if none. */
        fun getPendingStart(ctx: Context): Long? {
            val sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val v = sp.getLong(KEY_START, 0L)
            return if (v > 0L) v else null
        }

        /**
         * Write/remove the pending bedtime start. Called from JS bridge too
         * (so in-app "Going to bed" keeps the widget in sync).
         */
        fun setPendingStart(ctx: Context, startMs: Long?) {
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putLong(KEY_START, startMs ?: 0L)
                .apply()
            pushUpdate(ctx)
        }

        /** Redraw every instance of this widget with current state. */
        fun pushUpdate(ctx: Context) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, BedtimeWidget::class.java))
            if (ids.isNotEmpty()) {
                BedtimeWidget().onUpdate(ctx, mgr, ids)
            }
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val start = getPendingStart(context)
        val now = System.currentTimeMillis()
        // Safety: abandoned session (> 24h) resets on next redraw
        val active = start != null && (now - start) < MAX_SESSION_MS
        val views = RemoteViews(context.packageName, R.layout.widget_bedtime)

        if (active) {
            views.setTextViewText(R.id.widget_bedtime_label, "TAP WAKE UP")
            views.setTextViewText(R.id.widget_bedtime_time, formatElapsed(now - start!!))
            views.setImageViewResource(R.id.widget_bedtime_icon, R.drawable.widget_bedtime_active)
        } else {
            views.setTextViewText(R.id.widget_bedtime_label, "TAP BEDTIME")
            views.setTextViewText(R.id.widget_bedtime_time, "Sleep tracker")
            views.setImageViewResource(R.id.widget_bedtime_icon, R.drawable.widget_bedtime_idle)
        }

        views.setOnClickPendingIntent(R.id.widget_bedtime_container, buildTapIntent(context))
        appWidgetManager.updateAppWidget(appWidgetIds, views)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_TOGGLE) {
            handleToggle(context)
        }
    }

    private fun handleToggle(context: Context) {
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val start = getPendingStart(context)
        val now = System.currentTimeMillis()

        if (start == null || (now - start) >= MAX_SESSION_MS) {
            // Start a new bedtime session
            sp.edit().putLong(KEY_START, now).apply()
        } else {
            // Ending the session — hand start+end to the app via deep link.
            // The app (if running) logs the sleep entry; if not running, the
            // deep link opens the Sleep dashboard where JS picks it up from
            // SharedPreferences via the native bridge.
            sp.edit().putLong(KEY_START, 0L).apply()
            openAppWithSession(context, start, now)
        }
        pushUpdate(context)
    }

    private fun buildTapIntent(context: Context): PendingIntent {
        val intent = Intent(context, BedtimeWidget::class.java).apply {
            action = ACTION_TOGGLE
        }
        return PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun openAppWithSession(context: Context, startMs: Long, endMs: Long) {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = android.net.Uri.parse("meridian://bedtime?start=$startMs&end=$endMs")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        context.startActivity(intent)
    }

    private fun formatElapsed(ms: Long): String {
        val totalMin = ms / 60000
        val h = totalMin / 60
        val m = totalMin % 60
        return if (h > 0) "${h}h ${m}m" else "${m}m"
    }
}
