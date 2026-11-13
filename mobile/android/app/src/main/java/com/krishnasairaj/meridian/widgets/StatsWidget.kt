package com.krishnasairaj.meridian.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.krishnasairaj.meridian.MainActivity
import com.krishnasairaj.meridian.R
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * StatsWidget — 2x2 home-screen carousel with five screens.
 *
 *   1. CARD BILLS   — the total due (red) + the three biggest cards
 *   2. BANK BALANCE — the total + the three biggest accounts
 *   3. LENT         — the total lent + the three people (the late ones in red)
 *   4. MY WEALTH    — the net worth, today's change (green) + the split bar
 *   5. TASKS        — the pending count + three tasks with checkboxes
 *
 * The screens fade through every 3 seconds; the page dots at the bottom mark
 * the active one (a red pill). Tapping the widget goes to the next screen —
 * that is a broadcast, because a PendingIntent can only open something.
 */
class StatsWidget : AppWidgetProvider() {

    companion object {
        const val PREFS = "meridian_stats_widget"
        const val KEY_JSON = "stats_json"
        const val KEY_INDEX = "stats_index"

        /** The number of screens. */
        const val SCREENS = 5

        private val MUTED = Color.parseColor("#8A8A8A")
        private val RED = Color.parseColor("#E8002A")
        private val WHITE = Color.parseColor("#FFFFFF")
        private val GAIN = Color.parseColor("#3DDC84")
        private val DIM = Color.parseColor("#8E8E93")

        private val DOT_IDS = intArrayOf(
            R.id.stats_dot_1,
            R.id.stats_dot_2,
            R.id.stats_dot_3,
            R.id.stats_dot_4,
            R.id.stats_dot_5
        )

        /** Persist the latest stats JSON (from the JS bridge) and redraw. */
        fun setStats(ctx: Context, json: String) {
            val sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (json.isEmpty()) {
                sp.edit().remove(KEY_JSON).apply()
            } else {
                sp.edit().putString(KEY_JSON, json).apply()
            }
            pushUpdate(ctx)
        }

        /** The screen that is showing. */
        fun currentIndex(ctx: Context): Int =
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(KEY_INDEX, 0)

        /** Move to the next screen and redraw. */
        fun nextScreen(ctx: Context) {
            val sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val next = (currentIndex(ctx) + 1) % SCREENS
            sp.edit().putInt(KEY_INDEX, next).apply()
            pushUpdate(ctx)
        }

        /** Redraw every instance of this widget with the current state. */
        fun pushUpdate(ctx: Context) {
            try {
                val mgr = AppWidgetManager.getInstance(ctx)
                val ids = mgr.getAppWidgetIds(ComponentName(ctx, StatsWidget::class.java))
                if (ids.isNotEmpty()) {
                    StatsWidget().onUpdate(ctx, mgr, ids)
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
        val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_JSON, null)
        val index = currentIndex(context)
        for (id in appWidgetIds) {
            val views = try {
                buildViews(context, appWidgetManager, id, json, index)
            } catch (e: Exception) {
                fallbackViews(context)
            }
            try {
                appWidgetManager.updateAppWidget(id, views)
            } catch (e: Exception) {
                /* best-effort */
            }
        }
    }

    /** A minimal widget (used when the rendering fails). */
    private fun fallbackViews(context: Context): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_stats)
        views.setTextViewText(R.id.stats_bank_hero, "—")
        return views
    }

    private fun buildViews(
        context: Context,
        mgr: AppWidgetManager,
        widgetId: Int,
        json: String?,
        index: Int
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_stats)
        val barWidth = barWidthPx(context, mgr, widgetId)

        var cards = "—"
        var bank = "—"
        var lent = "—"
        var lentLabel = "NET LENT"
        var tasks = "—"
        var wealth = "—"
        var marketChange = "—"
        var changePct = 0.0
        val cardRows = mutableListOf<JSONObject>()
        val bankRows = mutableListOf<JSONObject>()
        val lentRows = mutableListOf<JSONObject>()
        val taskRows = mutableListOf<JSONObject>()
        val split = intArrayOf(0, 0, 0)

        if (!json.isNullOrEmpty()) {
            try {
                val o = JSONObject(json)
                if (o.has("ccBillsPaise")) cards = formatMoney(o.getLong("ccBillsPaise"))
                if (o.has("bankBalancePaise")) bank = formatMoney(o.getLong("bankBalancePaise"))
                if (o.has("netLentPaise")) {
                    val net = o.getLong("netLentPaise")
                    if (net < 0) {
                        lentLabel = "NET DEBIT"
                        lent = formatMoney(-net)
                    } else {
                        lent = formatMoney(net)
                    }
                }
                if (o.has("tasksLeft")) {
                    val left = o.getInt("tasksLeft")
                    tasks = if (left == 0) "✓" else left.toString()
                }
                if (o.has("netWorthPaise")) wealth = formatMoney(o.getLong("netWorthPaise"))
                if (o.has("dayChangePct")) {
                    val pct = o.optDouble("dayChangePct", 0.0)
                    val sign = if (pct < 0) "-" else "+"
                    changePct = pct
                    marketChange = "$sign${String.format(Locale.US, "%.1f", kotlin.math.abs(pct))}%"
                }
                readRows(o.optJSONArray("cardRows"), cardRows)
                readRows(o.optJSONArray("bankRows"), bankRows)
                readRows(o.optJSONArray("lentRows"), lentRows)
                readRows(o.optJSONArray("taskRows"), taskRows)
                val splitArray = o.optJSONArray("wealthSplit")
                for (i in 0 until minOf(3, splitArray?.length() ?: 0)) {
                    split[i] = splitArray?.optInt(i, 0) ?: 0
                }
            } catch (_: Exception) {
                // Malformed payload → keep the placeholders
            }
        }

        // 1. Card bills — the total due in red.
        views.setTextViewText(R.id.stats_bills_label, "CARD BILLS")
        views.setTextViewText(R.id.stats_bills_hero, cards)
        views.setTextColor(R.id.stats_bills_hero, RED)
        bindRows(views, cardRows, R.id.stats_bills_name_1, R.id.stats_bills_value_1,
            R.id.stats_bills_name_2, R.id.stats_bills_value_2,
            R.id.stats_bills_name_3, R.id.stats_bills_value_3)

        // 2. Bank balance.
        views.setTextViewText(R.id.stats_bank_label, "BANK BALANCE")
        views.setTextViewText(R.id.stats_bank_hero, bank)
        views.setTextColor(R.id.stats_bank_hero, WHITE)
        bindRows(views, bankRows, R.id.stats_bank_name_1, R.id.stats_bank_value_1,
            R.id.stats_bank_name_2, R.id.stats_bank_value_2,
            R.id.stats_bank_name_3, R.id.stats_bank_value_3)

        // 3. Lent — the late rows in red.
        views.setTextViewText(R.id.stats_lent_label, lentLabel)
        views.setTextViewText(R.id.stats_lent_hero, lent)
        views.setTextColor(R.id.stats_lent_hero, WHITE)
        bindRows(views, lentRows, R.id.stats_lent_name_1, R.id.stats_lent_value_1,
            R.id.stats_lent_name_2, R.id.stats_lent_value_2,
            R.id.stats_lent_name_3, R.id.stats_lent_value_3)

        // 4. My wealth — the change in green + the split bar.
        views.setTextViewText(R.id.stats_wealth_label, "MY WEALTH")
        views.setTextViewText(R.id.stats_wealth_hero, wealth)
        views.setTextColor(R.id.stats_wealth_hero, WHITE)
        views.setTextViewText(R.id.stats_wealth_today, "Today")
        views.setTextViewText(R.id.stats_wealth_change, marketChange)
        views.setTextColor(R.id.stats_wealth_change, if (changePct >= 0) GAIN else RED)
        bindSplit(views, split, barWidth)
        bindSplitLabels(views, split)

        // 5. Tasks — the pending count + the three tasks.
        views.setTextViewText(R.id.stats_tasks_label, "TASKS")
        views.setTextViewText(R.id.stats_tasks_count, tasks)
        views.setTextColor(R.id.stats_tasks_count, WHITE)
        bindTaskRows(views, taskRows)

        // The page dots.
        for (i in DOT_IDS.indices) {
            views.setImageViewResource(
                DOT_IDS[i],
                if (i == index) R.drawable.widget_stat_dot_active else R.drawable.widget_stat_dot
            )
        }

        // Show the screen that is marked.
        views.setDisplayedChild(R.id.stats_flipper, index)

        // Tapping goes to the next screen (a broadcast — a PendingIntent can
        // only open something, not flip a card).
        views.setOnClickPendingIntent(
            R.id.stats_container,
            PendingIntent.getBroadcast(
                context,
                5150,
                Intent(context, StatsWidgetActionReceiver::class.java).setAction(
                    StatsWidgetActionReceiver.ACTION_NEXT
                ),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        )

        // Long press opens the app (the launcher's own long-press action).
        views.setOnClickPendingIntent(
            R.id.stats_dots,
            PendingIntent.getActivity(
                context,
                5151,
                Intent(context, MainActivity::class.java).apply {
                    action = Intent.ACTION_VIEW
                    data = Uri.parse("meridian://home")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        )

        return views
    }

    /** Read the rows of a screen. */
    private fun readRows(array: JSONArray?, out: MutableList<JSONObject>) {
        if (array == null) return
        for (i in 0 until array.length()) {
            array.optJSONObject(i)?.let { out.add(it) }
        }
    }

    /**
     * Fill the three rows of a screen: the name on the left, the value on the
     * right (the late ones in red).
     */
    private fun bindRows(
        views: RemoteViews,
        rows: List<JSONObject>,
        name1: Int, value1: Int,
        name2: Int, value2: Int,
        name3: Int, value3: Int
    ) {
        val names = intArrayOf(name1, name2, name3)
        val values = intArrayOf(value1, value2, value3)
        for (index in 0..2) {
            val row = rows.getOrNull(index)
            if (row == null) {
                views.setViewVisibility(names[index], View.GONE)
                views.setViewVisibility(values[index], View.GONE)
                continue
            }
            views.setViewVisibility(names[index], View.VISIBLE)
            views.setViewVisibility(values[index], View.VISIBLE)
            views.setTextViewText(names[index], row.optString("name", ""))
            views.setTextViewText(values[index], row.optString("value", ""))
            val late = row.optBoolean("late", false)
            views.setTextColor(names[index], if (late) RED else WHITE)
            views.setTextColor(values[index], if (late) RED else WHITE)
        }
    }

    /** The task rows: a checkbox, the name (struck through when it is done). */
    private fun bindTaskRows(views: RemoteViews, rows: List<JSONObject>) {
        val names = intArrayOf(R.id.stats_tasks_name_1, R.id.stats_tasks_name_2, R.id.stats_tasks_name_3)
        val checks = intArrayOf(R.id.stats_tasks_check_1, R.id.stats_tasks_check_2, R.id.stats_tasks_check_3)
        for (index in 0..2) {
            val row = rows.getOrNull(index)
            if (row == null) {
                views.setViewVisibility(names[index], View.GONE)
                views.setViewVisibility(checks[index], View.GONE)
                continue
            }
            views.setViewVisibility(names[index], View.VISIBLE)
            views.setViewVisibility(checks[index], View.VISIBLE)
            val done = row.optBoolean("done", false)
            views.setTextViewText(names[index], row.optString("name", ""))
            views.setTextColor(names[index], if (done) DIM else WHITE)
            views.setImageViewResource(
                checks[index],
                if (done) R.drawable.widget_stat_check_done else R.drawable.widget_stat_check
            )
        }
    }

    /**
     * The wealth split bar — the three slices are drawn by padding a
     * full-width progress bar (the same trick the timeline uses). The
     * padding is in PIXELS, so the bar width has to be measured first.
     */
    private fun bindSplit(views: RemoteViews, split: IntArray, track: Int) {
        val ids = intArrayOf(R.id.stats_wealth_equity, R.id.stats_wealth_mf, R.id.stats_wealth_other)
        var start = 0
        for (index in 0..2) {
            val value = split.getOrElse(index) { 0 }.coerceIn(0, 100 - start)
            val from = (start * track / 100f).toInt()
            val to = ((start + value) * track / 100f).toInt()
            views.setViewPadding(ids[index], from, 0, (track - to).coerceAtLeast(0), 0)
            views.setProgressBar(ids[index], 100, 100, false)
            start += value
        }
    }

    /** The percentages under the bar, each in its segment's colour. */
    private fun bindSplitLabels(views: RemoteViews, split: IntArray) {
        val ids = intArrayOf(
            R.id.stats_wealth_label_1,
            R.id.stats_wealth_label_2,
            R.id.stats_wealth_label_3
        )
        for (i in 0..2) {
            views.setTextViewText(ids[i], "${split.getOrElse(i) { 0 }}%")
        }
    }

    /** Width of the split bar in pixels (the wealth screen's padding is 8dp). */
    private fun barWidthPx(context: Context, mgr: AppWidgetManager, widgetId: Int): Int {
        val options = mgr.getAppWidgetOptions(widgetId)
        val widthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110)
        val density = context.resources.displayMetrics.density
        return ((widthDp - 16).coerceAtLeast(40) * density).toInt()
    }

    /** Paise → "₹42,300" (or "₹3.8L" from a lakh up). */
    private fun formatMoney(paise: Long): String {
        val rupees = paise / 100.0
        if (rupees >= 100000) {
            return String.format(Locale.US, "₹%.1fL", rupees / 100000.0)
        }
        return "₹" + String.format(Locale.US, "%,d", Math.round(rupees))
    }
}
