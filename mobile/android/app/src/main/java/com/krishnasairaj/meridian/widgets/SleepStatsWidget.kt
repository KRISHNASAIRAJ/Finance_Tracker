package com.krishnasairaj.meridian.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.krishnasairaj.meridian.MainActivity
import com.krishnasairaj.meridian.R
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

/**
 * SleepStatsWidget — a 2x2 home-screen widget that shows **only** sleep.
 *
 * The compact version of the last night: the duration in a green pill, the
 * bedtime → wake time, the wake-ups and the sleep rating. The data is pushed
 * from JS (SleepStatsWidgetBridge) and cached in SharedPreferences, so the
 * widget survives a redraw and a process death.
 *
 * The widget refreshes itself every day at 9:00 AM (SleepWidgetScheduler) and
 * whenever the sleep log changes.
 */
class SleepStatsWidget : AppWidgetProvider() {

    companion object {
        const val PREFS = "meridian_sleep_stats_widget"
        const val KEY_JSON = "sleep_stats_json"

        /** Root padding + pill padding on each side (dp) — the timeline inset. */
        private const val TRACK_INSET_DP = 40

        private const val NO_VALUE = "—"

        /** Persist the latest sleep payload (from the JS bridge) and redraw. */
        fun setSleep(ctx: Context, json: String) {
            val sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (json.isEmpty()) {
                sp.edit().remove(KEY_JSON).apply()
            } else {
                sp.edit().putString(KEY_JSON, json).apply()
            }
            pushUpdate(ctx)
        }

        /** Redraw every instance of this widget with the current state. */
        fun pushUpdate(ctx: Context) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, SleepStatsWidget::class.java))
            if (ids.isNotEmpty()) {
                SleepStatsWidget().onUpdate(ctx, mgr, ids)
            }
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Keep the daily refresh armed whenever the widget is (re)drawn.
        SleepWidgetScheduler.schedule(context)
        val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_JSON, null)
        for (id in appWidgetIds) {
            appWidgetManager.updateAppWidget(
                id,
                buildViews(context, appWidgetManager, id, json)
            )
        }
    }

    private fun buildViews(
        context: Context,
        mgr: AppWidgetManager,
        widgetId: Int,
        json: String?
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_sleep_stats)

        var duration = NO_VALUE
        var bedTime = 0L
        var wakeTime = 0L
        var rem1Start = 0L
        var rem1End = 0L
        var rem2Start = 0L
        var rem2End = 0L
        var wakeUps = NO_VALUE
        var rating = NO_VALUE
        var bedText = NO_VALUE
        var wakeText = NO_VALUE

        if (!json.isNullOrEmpty()) {
            try {
                val o = JSONObject(json)
                if (o.optBoolean("hasSleep", false)) {
                    duration = formatDuration(o.optLong("durationMin", 0L))
                    bedTime = o.optLong("bedTime", 0L)
                    wakeTime = o.optLong("wakeTime", 0L)
                    rem1Start = o.optLong("rem1Start", 0L)
                    rem1End = o.optLong("rem1End", 0L)
                    rem2Start = o.optLong("rem2Start", 0L)
                    rem2End = o.optLong("rem2End", 0L)
                    val fmt = SimpleDateFormat("HH:mm", Locale.getDefault())
                    if (bedTime > 0L) bedText = fmt.format(Date(bedTime))
                    if (wakeTime > 0L) wakeText = fmt.format(Date(wakeTime))
                    val interruptions = o.optInt("interruptions", 0)
                    wakeUps = if (interruptions > 0) interruptions.toString() else "0"
                    val q = o.optInt("quality", 0)
                    rating = if (q > 0) "★".repeat(q.coerceAtMost(5)) else NO_VALUE
                }
            } catch (_: Exception) {
                // Malformed payload → keep the placeholders
            }
        }

        views.setTextViewText(R.id.sleep_stats_duration, duration)
        views.setTextViewText(R.id.sleep_stats_wakeups, wakeUps)
        views.setTextViewText(R.id.sleep_stats_rating, rating)
        views.setTextViewText(R.id.sleep_stats_bed, bedText)
        views.setTextViewText(R.id.sleep_stats_wake, wakeText)

        // The REM windows on the dotted timeline. The bars are drawn by padding
        // a full-width progress bar, so the segment lands exactly where it
        // should.
        val track = trackWidthPx(context, mgr, widgetId)
        val span = wakeTime - bedTime
        if (span > 0L) {
            if (rem1End > rem1Start) {
                val x1 = positionOf(rem1Start, bedTime, span, track)
                val x2 = positionOf(rem1End, bedTime, span, track)
                views.setViewPadding(R.id.sleep_stats_rem1, x1, 0, track - x2, 0)
                views.setProgressBar(R.id.sleep_stats_rem1, 100, 100, false)
            }
            if (rem2End > rem2Start) {
                val x1 = positionOf(rem2Start, bedTime, span, track)
                val x2 = positionOf(rem2End, bedTime, span, track)
                views.setViewPadding(R.id.sleep_stats_rem2, x1, 0, track - x2, 0)
                views.setProgressBar(R.id.sleep_stats_rem2, 100, 100, false)
            }
        }

        views.setOnClickPendingIntent(
            R.id.sleep_stats_container,
            deepLink(context, "meridian://sleep")
        )

        return views
    }

    /** Width of the dotted timeline in pixels. */
    private fun trackWidthPx(
        context: Context,
        mgr: AppWidgetManager,
        widgetId: Int
    ): Int {
        val options = mgr.getAppWidgetOptions(widgetId)
        val widthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110)
        val density = context.resources.displayMetrics.density
        return ((widthDp - TRACK_INSET_DP).coerceAtLeast(40) * density).toInt()
    }

    /** Position of a timestamp on the timeline, in pixels. */
    private fun positionOf(time: Long, bed: Long, span: Long, track: Int): Int {
        val ratio = (time - bed).toDouble() / span.toDouble()
        return (ratio * track).roundToInt().coerceIn(0, track)
    }

    /** 522 minutes → "8H 42M". */
    private fun formatDuration(minutes: Long): String {
        if (minutes <= 0L) return NO_VALUE
        val h = minutes / 60
        val m = minutes % 60
        return "${h}H ${m}M"
    }

    private fun deepLink(context: Context, uri: String): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse(uri)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            context,
            uri.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
