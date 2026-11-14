package com.krishnasairaj.meridian.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.krishnasairaj.meridian.MainActivity
import com.krishnasairaj.meridian.R
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

/**
 * SleepStatsWidget — a 2x2 home-screen widget that shows **only** sleep.
 *
 * The black-shell view of the last night: the duration, the DEEP / LIGHT /
 * AWAKE stage chart (drawn from the same motion timeline the Clock & Sleep
 * widget draws from), the bedtime → wake time, the wake-ups and the sleep
 * rating. The data is pushed from JS (SleepStatsWidgetBridge) and cached in
 * SharedPreferences, so the widget survives a redraw and a process death.
 *
 * The widget refreshes itself every day at 9:00 AM (SleepWidgetScheduler) and
 * whenever the sleep log changes.
 */
class SleepStatsWidget : AppWidgetProvider() {

    companion object {
        const val PREFS = "meridian_sleep_stats_widget"
        const val KEY_JSON = "sleep_stats_json"

        /** Root padding + lane label + track margin (dp) — the bar inset. */
        private const val TRACK_INSET_DP = 38

        private const val NO_VALUE = "—"

        private val DEEP_IDS = intArrayOf(
            R.id.sleep_stats_deep_1,
            R.id.sleep_stats_deep_2,
            R.id.sleep_stats_deep_3,
            R.id.sleep_stats_deep_4
        )
        private val LIGHT_IDS = intArrayOf(
            R.id.sleep_stats_light_1,
            R.id.sleep_stats_light_2,
            R.id.sleep_stats_light_3,
            R.id.sleep_stats_light_4
        )
        private val AWAKE_IDS = intArrayOf(
            R.id.sleep_stats_awake_1,
            R.id.sleep_stats_awake_2,
            R.id.sleep_stats_awake_3,
            R.id.sleep_stats_awake_4
        )

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
        var bedText = NO_VALUE
        var wakeText = NO_VALUE
        var wakeUps = NO_VALUE
        var rating = NO_VALUE
        val deep = mutableListOf<FloatArray>()
        val light = mutableListOf<FloatArray>()
        val awake = mutableListOf<FloatArray>()

        if (!json.isNullOrEmpty()) {
            try {
                val o = JSONObject(json)
                if (o.optBoolean("hasSleep", false)) {
                    duration = formatDuration(o.optLong("durationMin", 0L))
                    val bedTime = o.optLong("bedTime", 0L)
                    val wakeTime = o.optLong("wakeTime", 0L)
                    val fmt = SimpleDateFormat("HH:mm", Locale.getDefault())
                    if (bedTime > 0L) bedText = fmt.format(Date(bedTime))
                    if (wakeTime > 0L) wakeText = fmt.format(Date(wakeTime))
                    val interruptions = o.optInt("interruptions", 0)
                    wakeUps = if (interruptions > 0) interruptions.toString() else "0"
                    val q = o.optInt("quality", 0)
                    rating = if (q > 0) "★".repeat(q.coerceAtMost(5)) else NO_VALUE
                }
                val stages = o.optJSONObject("stages")
                if (stages != null) {
                    readSegments(stages.optJSONArray("deep"), deep)
                    readSegments(stages.optJSONArray("light"), light)
                    readSegments(stages.optJSONArray("awake"), awake)
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

        // The DEEP / LIGHT / AWAKE stage chart — the bars are drawn by padding
        // a full-width progress bar, so the segment lands exactly where it
        // should.
        val track = trackWidthPx(context, mgr, widgetId)
        bindSegments(views, deep, DEEP_IDS, track)
        bindSegments(views, light, LIGHT_IDS, track)
        bindSegments(views, awake, AWAKE_IDS, track)

        views.setOnClickPendingIntent(
            R.id.sleep_stats_container,
            deepLink(context, "meridian://sleep")
        )

        return views
    }

    /** Read the stage segments of a lane: [start, length] of the night. */
    private fun readSegments(array: JSONArray?, out: MutableList<FloatArray>) {
        if (array == null) return
        for (i in 0 until array.length()) {
            val pair = array.optJSONArray(i) ?: continue
            val start = pair.optDouble(0, 0.0).toFloat()
            val len = pair.optDouble(1, 0.0).toFloat()
            if (len <= 0f) continue
            out.add(floatArrayOf(start, len))
        }
    }

    /**
     * Draw the bars of one lane — a segment is positioned by padding a
     * full-width progress bar (the same trick the REM timeline used).
     */
    private fun bindSegments(
        views: RemoteViews,
        segments: List<FloatArray>,
        ids: IntArray,
        track: Int
    ) {
        for (index in ids.indices) {
            val id = ids[index]
            val segment = segments.getOrNull(index)
            if (segment == null) {
                views.setViewVisibility(id, View.GONE)
                continue
            }
            views.setViewVisibility(id, View.VISIBLE)
            val from = (segment[0].coerceIn(0f, 1f) * track).toInt()
            val to = ((segment[0] + segment[1]).coerceIn(0f, 1f) * track).toInt()
            val width = (to - from).coerceAtLeast(1)
            views.setViewPadding(id, from, 0, (track - width).coerceAtLeast(0), 0)
            views.setProgressBar(id, 100, 100, false)
        }
    }

    /** Width of the stage track in pixels. */
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
