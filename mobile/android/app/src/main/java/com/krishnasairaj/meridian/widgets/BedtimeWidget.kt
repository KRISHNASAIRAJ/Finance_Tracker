package com.krishnasairaj.meridian.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import com.krishnasairaj.meridian.MainActivity
import com.krishnasairaj.meridian.R

/**
 * BedtimeWidget — tap to mark "going to bed" (start), tap again to mark
 * "good morning" (stop). The widget itself is stateless; the pending bedtime
 * timestamp is persisted in SharedPreferences so it survives widget redraws,
 * process death, and is readable from JS (SleepWidgetBridge).
 *
 * Tap 1: writes start time, label flips to "WAKE", Live Chronometer ticks.
 * Tap 2: writes an "ended" marker (start+end kept for JS pickup), broadcasts
 *        to the app (deep link with start/end), and renders idle again.
 *        The app clears the marker after logging (setPendingStart(null)).
 *
 * Long-press or elapsed > 24h safety: auto-resets (treats as abandoned session).
 */
private const val ACTION_TOGGLE = "com.krishnasairaj.meridian.widgets.ACTION_BEDTIME_TOGGLE"

class BedtimeWidget : AppWidgetProvider() {

    companion object {
        const val PREFS = "meridian_bedtime_widget"
        const val KEY_START = "bedtime_start_ms"
        const val KEY_ENDED_AT = "bedtime_end_ms"
        const val MAX_SESSION_MS = 24 * 60 * 60 * 1000L  // 24h cap

        /** Read the pending bedtime start (epoch ms), or null if none/ended. */
        fun getPendingStart(ctx: Context): Long? {
            val sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val v = sp.getLong(KEY_START, 0L)
            val ended = sp.getLong(KEY_ENDED_AT, 0L)
            return if (v > 0L && ended <= 0L) v else null
        }

        /**
         * An ended-but-unconsumed session (start, end) that the app has not
         * logged yet. Used as a data-loss fallback when the deep link fails.
         */
        fun getEndedSession(ctx: Context): Pair<Long, Long>? {
            val sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val v = sp.getLong(KEY_START, 0L)
            val ended = sp.getLong(KEY_ENDED_AT, 0L)
            return if (v > 0L && ended > v) Pair(v, ended) else null
        }

        /**
         * Write/remove the pending bedtime start. Called from JS bridge too
         * (so in-app "Going to bed" keeps the widget in sync). Passing null
         * clears both the active start and any ended marker.
         */
        fun setPendingStart(ctx: Context, startMs: Long?) {
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putLong(KEY_START, startMs ?: 0L)
                .putLong(KEY_ENDED_AT, 0L)
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
            views.setTextViewText(R.id.widget_bedtime_label, "WAKE")
            views.setViewVisibility(R.id.widget_bedtime_time, View.VISIBLE)
            views.setViewVisibility(R.id.widget_bedtime_hint, View.GONE)
            // Live-ticking elapsed time — the Chronometer keeps rendering on
            // its own, no periodic widget updates needed. Base must be in
            // SystemClock.elapsedRealtime() space, not epoch ms.
            val chronometerBase = android.os.SystemClock.elapsedRealtime() - (now - start!!)
            views.setChronometer(R.id.widget_bedtime_time, chronometerBase, null, true)
            views.setImageViewResource(R.id.widget_bedtime_icon, R.drawable.widget_bedtime_active)
        } else {
            views.setTextViewText(R.id.widget_bedtime_label, "BED")
            views.setViewVisibility(R.id.widget_bedtime_time, View.GONE)
            views.setViewVisibility(R.id.widget_bedtime_hint, View.VISIBLE)
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
            sp.edit().putLong(KEY_START, now).putLong(KEY_ENDED_AT, 0L).apply()
        } else {
            // Ending the session. Keep start+end in SharedPreferences so the
            // app can still pick the session up if the deep link is slow or
            // the app is cold-started (SleepDashboardScreen fallback via
            // BedtimeWidgetBridge). The app clears the marker after logging
            // (see App.tsx handleDeepLink and SleepDashboardScreen).
            sp.edit().putLong(KEY_ENDED_AT, now).apply()
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
}
