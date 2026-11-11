package com.krishnasairaj.meridian.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews
import com.krishnasairaj.meridian.MainActivity
import com.krishnasairaj.meridian.R
import org.json.JSONObject
import java.util.Locale

/**
 * StatsWidget — compact daily stats tile (replaces the old "Report"
 * quick-action tile). Renders a 2x2 snapshot (spend today, tasks left,
 * habits, last sleep) written by the JS side via StatsWidgetBridge into
 * SharedPreferences, so values survive widget redraws and process death.
 * Tapping the widget opens the full Combined Report (deep link unchanged).
 *
 * Missing/absent stats render as placeholders ("—") — the widget is
 * informative but never blocks on app state.
 */
class StatsWidget : AppWidgetProvider() {

    companion object {
        const val PREFS = "meridian_stats_widget"
        const val KEY_JSON = "stats_json"

        private val MUTED = Color.parseColor("#8E8EA0")
        private val BLUE = Color.parseColor("#64D2FF")
        private val GREEN = Color.parseColor("#7EE787")
        private val MONTHS = arrayOf(
            "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
            "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
        )

        /** Persist the latest stats JSON (from JS bridge) and redraw. */
        fun setStats(ctx: Context, json: String) {
            val sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (json.isEmpty()) {
                sp.edit().remove(KEY_JSON).apply()
            } else {
                sp.edit().putString(KEY_JSON, json).apply()
            }
            pushUpdate(ctx)
        }

        /** Redraw every instance of this widget with current state. */
        fun pushUpdate(ctx: Context) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, StatsWidget::class.java))
            if (ids.isNotEmpty()) {
                StatsWidget().onUpdate(ctx, mgr, ids)
            }
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_JSON, null)
        val views = buildViews(context, json)
        appWidgetManager.updateAppWidget(appWidgetIds, views)
    }

    private fun buildViews(context: Context, json: String?): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_stats)

        var title = "TODAY"
        var spend = "—"
        var tasks = "—"
        var tasksColor = MUTED
        var habits = "—"
        var sleep = "—"

        if (!json.isNullOrEmpty()) {
            try {
                val o = JSONObject(json)

                val dayKey = o.optString("dayKey", "")
                if (dayKey.length >= 10) title = "TODAY · " + dayTitle(dayKey)

                if (o.has("spendPaise") && o.optInt("spendPaise", -1) >= 0) {
                    spend = formatSpend(o.getInt("spendPaise"))
                }

                val tasksLeft = o.optInt("tasksLeft", -1)
                if (tasksLeft >= 0) {
                    if (tasksLeft == 0) {
                        tasks = "✓"
                        tasksColor = GREEN
                    } else {
                        tasks = tasksLeft.toString()
                        tasksColor = BLUE
                    }
                }

                val done = o.optInt("habitsDone", -1)
                val total = o.optInt("habitsTotal", -1)
                if (done >= 0 && total >= 0) {
                    habits = "$done/$total"
                }

                val hours = o.optDouble("sleepHours", Double.NaN)
                if (!hours.isNaN() && hours > 0) {
                    sleep = formatSleep(hours)
                }
            } catch (_: Exception) {
                // Malformed payload → keep placeholders
            }
        }

        views.setTextViewText(R.id.stats_title, title)
        views.setTextViewText(R.id.stats_spend, spend)
        views.setTextViewText(R.id.stats_tasks, tasks)
        views.setTextColor(R.id.stats_tasks, tasksColor)
        views.setTextViewText(R.id.stats_habits, habits)
        views.setTextViewText(R.id.stats_sleep, sleep)
        views.setOnClickPendingIntent(R.id.stats_container, buildClickIntent(context))
        return views
    }

    /** Paise → "₹845" or "₹1.2k" (no locale-dependent grouping). */
    private fun formatSpend(paise: Int): String {
        val rupees = paise / 100.0
        return if (rupees >= 1000) {
            String.format(Locale.US, "₹%.1fk", rupees / 1000.0)
        } else {
            String.format(Locale.US, "₹%d", Math.round(rupees))
        }
    }

    /** Hours → "7h" or "7h 20m". */
    private fun formatSleep(hours: Double): String {
        val h = hours.toInt()
        val m = Math.round((hours - h) * 60 / 10.0).toInt() * 10
        return if (m >= 10) String.format(Locale.US, "%dh %dm", h, m) else String.format(Locale.US, "%dh", h)
    }

    /** "2026-11-11" → "NOV 11". */
    private fun dayTitle(dayKey: String): String {
        return try {
            val parts = dayKey.split("-")
            "${MONTHS[parts[1].toInt() - 1]} ${parts[2].toInt()}"
        } catch (_: Exception) {
            ""
        }
    }

    private fun buildClickIntent(context: Context): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("meridian://combined-report")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
