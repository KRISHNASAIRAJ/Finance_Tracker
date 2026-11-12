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
import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * ClockSleepWidget — 2x2 home-screen widget with a live clock and the last
 * night of sleep.
 *
 * The clock (date, HH:mm and the seconds) are TextClock views, so the widget
 * keeps itself up to date without any periodic work. The sleep data (duration,
 * the two REM windows on the timeline) is pushed from JS through
 * ClockSleepWidgetBridge and cached in SharedPreferences, so it survives
 * widget redraws and process death.
 *
 * The live weather (Open-Meteo) rides in the same payload: the icon and the
 * temperature in the top right, the condition under the clock.
 */
class ClockSleepWidget : AppWidgetProvider() {

    companion object {
        const val PREFS = "meridian_clock_sleep_widget"
        const val KEY_JSON = "clock_sleep_json"

        /** Root padding + pill padding on each side (dp) — the timeline inset. */
        private const val TRACK_INSET_DP = 32

        /** Placeholder until a weather API is connected. */
        private const val DEFAULT_WEATHER = "—"

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
            try {
                val mgr = AppWidgetManager.getInstance(ctx)
                val ids = mgr.getAppWidgetIds(ComponentName(ctx, ClockSleepWidget::class.java))
                if (ids.isNotEmpty()) {
                    ClockSleepWidget().onUpdate(ctx, mgr, ids)
                }
            } catch (e: Exception) {
                /* best-effort */
            }
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Keep the daily 9:00 AM refresh armed.
        SleepWidgetScheduler.schedule(context)
        val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_JSON, null)
        for (id in appWidgetIds) {
            val views = try {
                buildViews(context, appWidgetManager, id, json)
            } catch (e: Exception) {
                // Never crash the launcher: fall back to a plain clock.
                fallbackViews(context)
            }
            try {
                appWidgetManager.updateAppWidget(id, views)
            } catch (e: Exception) {
                /* best-effort */
            }
        }
    }

    /** A minimal widget that only shows the clock (used when rendering fails). */
    private fun fallbackViews(context: Context): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_clock_sleep)
        views.setTextViewText(R.id.clock_sleep_duration, NO_VALUE)
        views.setTextViewText(R.id.clock_sleep_weather, DEFAULT_WEATHER)
        return views
    }

    private fun buildViews(
        context: Context,
        mgr: AppWidgetManager,
        widgetId: Int,
        json: String?
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_clock_sleep)

        var duration = NO_VALUE
        var weather = NO_VALUE
        var weatherIcon = "cloud"
        var weatherCondition = ""
        var weatherRange = ""
        var bedTime = 0L
        var wakeTime = 0L
        var rem1Start = 0L
        var rem1End = 0L
        var rem2Start = 0L
        var rem2End = 0L

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
                }
                // The live weather (Open-Meteo) — the top right of the widget.
                val text = o.optString("weatherText", "")
                if (text.isNotEmpty()) weather = text
                weatherIcon = o.optString("weatherIcon", "cloud")
                weatherCondition = o.optString("weatherCondition", "")
                val minC = o.optDouble("weatherMinC", 0.0)
                val maxC = o.optDouble("weatherMaxC", 0.0)
                if (maxC > minC) {
                    weatherRange = " · " + formatTemp(minC) + "/" + formatTemp(maxC)
                }
            } catch (_: Exception) {
                // Malformed payload → keep the placeholders
            }
        }

        views.setTextViewText(R.id.clock_sleep_duration, duration)
        views.setTextViewText(R.id.clock_sleep_weather, weather)
        views.setImageViewResource(R.id.clock_sleep_weather_icon, weatherIconRes(weatherIcon))
        val condition = if (weatherCondition.isEmpty()) "" else weatherCondition + weatherRange
        views.setTextViewText(R.id.clock_sleep_condition, condition)
        // No condition → no line at all (the red bar takes the space).
        views.setViewVisibility(
            R.id.clock_sleep_condition,
            if (condition.isEmpty()) View.GONE else View.VISIBLE
        )

        // REM windows on the dotted timeline. The bars are drawn by padding a
        // full-width progress bar, so the segment lands exactly where it should.
        val track = trackWidthPx(context, mgr, widgetId)
        val span = wakeTime - bedTime
        if (span > 0L) {
            if (rem1End > rem1Start) {
                val x1 = positionOf(rem1Start, bedTime, span, track)
                val x2 = positionOf(rem1End, bedTime, span, track)
                views.setViewPadding(R.id.clock_sleep_rem1, x1, 0, track - x2, 0)
                views.setProgressBar(R.id.clock_sleep_rem1, 100, 100, false)
            }
            if (rem2End > rem2Start) {
                val x1 = positionOf(rem2Start, bedTime, span, track)
                val x2 = positionOf(rem2End, bedTime, span, track)
                views.setViewPadding(R.id.clock_sleep_rem2, x1, 0, track - x2, 0)
                views.setProgressBar(R.id.clock_sleep_rem2, 100, 100, false)
            }
        }

        views.setOnClickPendingIntent(
            R.id.clock_sleep_container,
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

    /** 28.4 → "28°". */
    private fun formatTemp(celsius: Double): String {
        if (celsius <= -50.0 || celsius >= 60.0) return "—"
        return "${Math.round(celsius)}°"
    }

    /** The weather icon that matches the condition. */
    private fun weatherIconRes(icon: String): Int = when (icon) {
        "sun" -> R.drawable.widget_sun
        "rain" -> R.drawable.widget_rain
        else -> R.drawable.widget_cloud
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
