package com.krishnasairaj.meridian.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.BatteryManager
import android.text.SpannableString
import android.text.Spanned
import android.text.SpannableStringBuilder
import android.text.style.AbsoluteSizeSpan
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.view.View
import android.widget.RemoteViews
import com.krishnasairaj.meridian.MainActivity
import com.krishnasairaj.meridian.R
import org.json.JSONArray
import org.json.JSONObject

/**
 * ClockSleepWidget — 2x2 home-screen widget with a live clock and the last
 * night of sleep.
 *
 * The clock (the date, the hours, the minutes and the seconds) are TextClock
 * views, so the widget keeps itself up to date without any periodic work. The
 * sleep data (the duration, the score, the DEEP / LIGHT / AWAKE stage chart,
 * the bed and wake times) is pushed from JS through ClockSleepWidgetBridge and
 * cached in SharedPreferences, so it survives widget redraws and process death.
 *
 * The stats row under the red block shows the next alarm, the battery and the
 * temperature.
 */
class ClockSleepWidget : AppWidgetProvider() {

    companion object {
        const val PREFS = "meridian_clock_sleep_widget"
        const val KEY_JSON = "clock_sleep_json"

        /** GPS fix + weather keys — the native Open-Meteo fetch. */
        private const val KEY_WEATHER_LAT = "weather_lat_native"
        private const val KEY_WEATHER_LON = "weather_lon_native"
        private const val KEY_WEATHER_TEMP_C = "weather_temp_c_native"
        private const val KEY_WEATHER_AT = "weather_fetched_at_native"
        private const val KEY_WEATHER_PAYLOAD_TEMP_C = "weather_temp_c_payload"
        private const val KEY_WEATHER_PAYLOAD_AT = "weather_fetched_at_payload"

        /** The native re-fetch is throttled to this floor (one call per ~20 min). */
        private const val WEATHER_MIN_FETCH_MS = 20L * 60_000L
        /** A native reading older than this is never shown. */
        private const val WEATHER_NATIVE_MAX_AGE_MS = 12L * 60 * 60_000L

        /** Root padding + pill padding + the lane label, both sides (dp). */
        private const val TRACK_INSET_DP = 44

        private const val NO_VALUE = "—"
        /** Shown until the realtime weather lands. */
        private const val DEFAULT_TEMP_C = 24.0

        /** The muted grey of the stats (the "--" of a missing alarm). */
        private val MUTED = Color.parseColor("#8A8A8A")

        /** The OnePlus red. */
        private val RED = Color.parseColor("#E8002A")

        /** The bars of the three lanes (four slots each). */
        private val DEEP_IDS = intArrayOf(
            R.id.clock_sleep_deep_1,
            R.id.clock_sleep_deep_2,
            R.id.clock_sleep_deep_3,
            R.id.clock_sleep_deep_4
        )
        private val LIGHT_IDS = intArrayOf(
            R.id.clock_sleep_light_1,
            R.id.clock_sleep_light_2,
            R.id.clock_sleep_light_3,
            R.id.clock_sleep_light_4
        )
        private val AWAKE_IDS = intArrayOf(
            R.id.clock_sleep_awake_1,
            R.id.clock_sleep_awake_2,
            R.id.clock_sleep_awake_3,
            R.id.clock_sleep_awake_4
        )

        private val WEEKDAYS = arrayOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
        private val MONTHS = arrayOf(
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        )

        /** The known clock apps — the AOSP one is what OnePlus ships. */
        private val CLOCK_PACKAGES = arrayOf(
            "com.android.deskclock",
            "com.oneplus.deskclock",
            "com.google.android.deskclock",
            "com.sec.android.app.clock",
            "com.miui.clock"
        )

        /** The resolved clock app (cached — it is looked up on every redraw). */
        private var clockIntent: Intent? = null

        /** Persist the latest sleep payload (from the JS bridge) and redraw. */
        fun setSleep(ctx: Context, json: String) {
            val sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (json.isEmpty()) {
                sp.edit().remove(KEY_JSON)
                    .remove(KEY_WEATHER_PAYLOAD_TEMP_C)
                    .remove(KEY_WEATHER_PAYLOAD_AT)
                    .apply()
            } else {
                val edit = sp.edit().putString(KEY_JSON, json)
                try {
                    val o = JSONObject(json)
                    // The GPS fix the in-app weather used (rounded ~1 km).
                    val lat = o.optDouble("weatherLat", Double.NaN)
                    val lon = o.optDouble("weatherLon", Double.NaN)
                    if (!lat.isNaN() && !lon.isNaN() &&
                        lat >= -90.0 && lat <= 90.0 && lon >= -180.0 && lon <= 180.0
                    ) {
                        edit.putFloat(KEY_WEATHER_LAT, lat.toFloat())
                        edit.putFloat(KEY_WEATHER_LON, lon.toFloat())
                    }
                    // The reading is only worth storing when it was a real
                    // fetch — the placeholder default never reaches the disk.
                    val payloadAt = o.optLong("weatherFetchedAt", 0L)
                    val payloadTemp = o.optDouble("tempC", Double.NaN)
                    if (payloadAt > 0L && !payloadTemp.isNaN() &&
                        payloadTemp > -60.0 && payloadTemp < 70.0
                    ) {
                        edit.putFloat(KEY_WEATHER_PAYLOAD_TEMP_C, payloadTemp.toFloat())
                        edit.putLong(KEY_WEATHER_PAYLOAD_AT, payloadAt)
                    }
                } catch (_: Exception) {
                    // Keep the sleep payload, drop only the weather extras.
                }
                edit.apply()
            }
            pushUpdate(ctx)
        }

        /**
         * The realtime weather — Open-Meteo, for the GPS fix cached by the
         * last app push (the same ~1 km fix the in-app weather uses).
         *
         * Called from the 10-minute widget alarm on a background thread, so
         * the temperature stays live even when the app has not been opened
         * for days. Throttled to one fetch per 20 minutes; any failure keeps
         * the last reading (the alarm must never crash).
         */
        fun refreshWeatherBlocking(context: Context) {
            try {
                val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                val lat = sp.getFloat(KEY_WEATHER_LAT, Float.NaN)
                val lon = sp.getFloat(KEY_WEATHER_LON, Float.NaN)
                if (lat.isNaN() || lon.isNaN()) return
                if (System.currentTimeMillis() - sp.getLong(KEY_WEATHER_AT, 0L) < WEATHER_MIN_FETCH_MS) return
                val url = java.net.URL(
                    "https://api.open-meteo.com/v1/forecast?" +
                        "latitude=$lat&longitude=$lon" +
                        "&current=temperature_2m,weather_code&timezone=auto"
                )
                val conn = (url.openConnection() as? java.net.HttpURLConnection) ?: return
                try {
                    conn.connectTimeout = 5000
                    conn.readTimeout = 5000
                    conn.requestMethod = "GET"
                    if (conn.responseCode != 200) return
                    val body = conn.inputStream.bufferedReader().use { it.readText() }
                    val temp = JSONObject(body).optJSONObject("current")
                        ?.optDouble("temperature_2m", Double.NaN) ?: Double.NaN
                    if (temp.isNaN() || temp < -60.0 || temp > 70.0) return
                    sp.edit()
                        .putFloat(KEY_WEATHER_TEMP_C, temp.toFloat())
                        .putLong(KEY_WEATHER_AT, System.currentTimeMillis())
                        .apply()
                } finally {
                    conn.disconnect()
                }
            } catch (_: Exception) {
                /* best-effort — the alarm must survive a dead network */
            }
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
        var scoreValue = 0
        var bedLabel = ""
        var wakeLabel = ""
        var alarmLabel = ""
        var tempC = DEFAULT_TEMP_C
        val deep = mutableListOf<FloatArray>()
        val light = mutableListOf<FloatArray>()
        val awake = mutableListOf<FloatArray>()

        if (!json.isNullOrEmpty()) {
            try {
                val o = JSONObject(json)
                if (o.optBoolean("hasSleep", false)) {
                    duration = formatDuration(o.optLong("durationMin", 0L))
                }
                scoreValue = o.optInt("score", 0)
                bedLabel = o.optString("bedLabel", "")
                wakeLabel = o.optString("wakeLabel", "")
                alarmLabel = o.optString("alarmLabel", "")
                // Realtime weather: the fresher of the JS reading (GPS on
                // every app open) and the widget's own Open-Meteo fetch.
                val spWeather = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                val payloadTemp = spWeather.getFloat(KEY_WEATHER_PAYLOAD_TEMP_C, Float.NaN)
                val payloadAt = spWeather.getLong(KEY_WEATHER_PAYLOAD_AT, 0L)
                val nativeTemp = spWeather.getFloat(KEY_WEATHER_TEMP_C, Float.NaN)
                val nativeAt = spWeather.getLong(KEY_WEATHER_AT, 0L)
                val payloadOk = payloadAt > 0L && !payloadTemp.isNaN()
                val nativeOk = nativeAt > 0L && !nativeTemp.isNaN() &&
                    System.currentTimeMillis() - nativeAt < WEATHER_NATIVE_MAX_AGE_MS
                tempC = when {
                    payloadOk && (!nativeOk || payloadAt >= nativeAt) -> payloadTemp.toDouble()
                    nativeOk -> nativeTemp.toDouble()
                    payloadOk -> payloadTemp.toDouble()
                    else -> {
                        // Legacy payloads pushed before the weather extras.
                        val tc = o.optDouble("tempC", Double.NaN)
                        if (!tc.isNaN() && tc > -50.0 && tc < 60.0) tc else DEFAULT_TEMP_C
                    }
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

        views.setTextViewText(R.id.clock_sleep_duration, combinedDurationAndScore(duration, scoreValue))
        views.setTextViewText(R.id.clock_sleep_date, dateText())
        views.setTextViewText(R.id.clock_sleep_bed, bedLabel)
        views.setTextViewText(R.id.clock_sleep_wake, wakeLabel)

        // The alarm — a grey "--" when there is none.
        if (alarmLabel.isEmpty()) {
            views.setTextViewText(R.id.clock_sleep_alarm_value, "--")
            views.setTextColor(R.id.clock_sleep_alarm_value, MUTED)
        } else {
            views.setTextViewText(R.id.clock_sleep_alarm_value, alarmLabel)
            views.setTextColor(R.id.clock_sleep_alarm_value, RED)
        }

        // The battery.
        val battery = batteryPercent(context)
        if (battery > 0) {
            views.setTextViewText(R.id.clock_sleep_batt_value, "$battery%")
        } else {
            views.setTextViewText(R.id.clock_sleep_batt_value, NO_VALUE)
        }

        // The temperature — realtime: whichever of the JS payload (GPS-fresh
        // on every app open) and the widget's own fetch (every ~10 minutes)
        // is the fresher one.
        views.setTextViewText(R.id.clock_sleep_temp_value, "${Math.round(tempC)}°")

        // The stage chart — the bars are drawn by padding a full-width progress
        // bar, so the segment lands exactly where it should.
        val track = trackWidthPx(context, mgr, widgetId)
        bindSegments(views, deep, DEEP_IDS, track)
        bindSegments(views, light, LIGHT_IDS, track)
        bindSegments(views, awake, AWAKE_IDS, track)

        // Tapping the widget opens the device's own clock app (the red sleep
        // bar included — the whole widget is one target). When the phone has no
        // clock app the tap falls back to Meridian's sleep screen.
        val clockIntent = clockAppIntent(context)
        val clockPending = if (clockIntent != null) {
            PendingIntent.getActivity(
                context,
                4242,
                clockIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        } else {
            deepLink(context, "meridian://sleep")
        }
        views.setOnClickPendingIntent(R.id.clock_sleep_container, clockPending)
        views.setOnClickPendingIntent(R.id.clock_sleep_pill, clockPending)

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

    /**
     * The battery level in percent (0–100), or -1 when it cannot be read.
     * No permission is needed for the capacity.
     */
    private fun batteryPercent(context: Context): Int {
        return try {
            val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager ?: return -1
            val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            if (level in 1..100) level else -1
        } catch (e: Exception) {
            -1
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

    /**
     * The duration (bold) over the sleep score, left-aligned inside the
     * raised island — the reference look.
     */
    private fun combinedDurationAndScore(duration: String, scoreValue: Int): CharSequence {
        if (duration == NO_VALUE || scoreValue <= 0) return duration
        val line1 = duration
        val line2 = "Score $scoreValue"
        val sb = SpannableStringBuilder("$line1\n$line2")
        sb.setSpan(StyleSpan(Typeface.BOLD), 0, line1.length, SpannableStringBuilder.SPAN_EXCLUSIVE_EXCLUSIVE)
        sb.setSpan(AbsoluteSizeSpan(10, true), 0, line1.length, SpannableStringBuilder.SPAN_EXCLUSIVE_EXCLUSIVE)
        sb.setSpan(AbsoluteSizeSpan(6, true), line1.length + 1, sb.length, SpannableStringBuilder.SPAN_EXCLUSIVE_EXCLUSIVE)
        return sb
    }

    /** 522 minutes → "8H 42M". */
    private fun formatDuration(minutes: Long): String {
        if (minutes <= 0L) return NO_VALUE
        val h = minutes / 60
        val m = minutes % 60
        return "${h}H ${m}M"
    }

    /**
     * The device's OWN clock app — tapping the widget opens the system clock
     * instead of Meridian.
     *
     * The chain, most reliable first:
     *   1. the known clock packages (an explicit launcher intent — it always
     *      works, whatever filters the clock app declares),
     *   2. any launcher activity whose package looks like a clock,
     *   3. the standard `clock://` view intent.
     *
     * When the phone has no clock app at all the widget falls back to
     * Meridian's sleep screen, so the tap is never dead.
     */
    private fun clockAppIntent(context: Context): Intent? {
        clockIntent?.let { return it }
        val pm = context.packageManager
        var found: Intent? = null
        try {
            // 1. The known clock packages.
            for (pkg in CLOCK_PACKAGES) {
                val launch = try {
                    pm.getLaunchIntentForPackage(pkg)
                } catch (e: Exception) {
                    null
                }
                if (launch != null) {
                    found = launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    break
                }
            }
            // 2. Any launcher activity that looks like a clock.
            if (found == null) {
                val main = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                val activities = pm.queryIntentActivities(main, 0)
                val clock = activities.firstOrNull {
                    it.activityInfo.packageName.contains("clock", ignoreCase = true)
                }
                if (clock != null) {
                    found = Intent()
                        .setClassName(clock.activityInfo.packageName, clock.activityInfo.name)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            }
            // 3. The standard clock:// scheme.
            if (found == null) {
                val view = Intent(Intent.ACTION_VIEW, Uri.parse("clock://"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (pm.resolveActivity(view, 0) != null) found = view
            }
        } catch (e: Exception) {
            /* fall through — the caller falls back to Meridian */
        }
        clockIntent = found
        return found
    }

    /**
     * The date — "Thu 12 Nov" — with the FIRST digit of a double-digit day in
     * the OnePlus red and the second digit in white. A single-digit day is
     * white as well.
     */
    private fun dateText(): CharSequence {
        val cal = java.util.Calendar.getInstance()
        val weekday = WEEKDAYS[cal.get(java.util.Calendar.DAY_OF_WEEK) - 1]
        val month = MONTHS[cal.get(java.util.Calendar.MONTH)]
        val day = cal.get(java.util.Calendar.DAY_OF_MONTH)
        val dayText = day.toString()

        // The day number is entirely red - both digits of a double-digit day.
        // The weekday and the month keep the layout colour (grey).
        val text = SpannableString("$weekday $dayText $month")
        val start = weekday.length + 1
        text.setSpan(
            ForegroundColorSpan(RED),
            start,
            start + dayText.length,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )
        return text
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
