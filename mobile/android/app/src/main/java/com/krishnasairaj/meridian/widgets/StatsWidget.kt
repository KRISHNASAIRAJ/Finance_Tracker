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
import org.json.JSONObject
import java.util.Locale

/**
 * StatsWidget — 2x2 home-screen carousel. Seven stat cards (monthly spend,
 * CC bills, bank balance, net lent/debit, tasks left, net wealth and today's
 * market performance) live in a ViewFlipper that auto-advances every 3
 * seconds with a fade; tapping a card deep-links to that screen.
 *
 * Values are pushed from JS (StatsWidgetBridge) into SharedPreferences, so
 * they survive widget redraws and process death. Missing stats render as
 * placeholders ("—") — the widget never blocks on app state.
 */
class StatsWidget : AppWidgetProvider() {

    companion object {
        const val PREFS = "meridian_stats_widget"
        const val KEY_JSON = "stats_json"

        private val MUTED = Color.parseColor("#8E8E93")
        // OnePlus OxygenOS: the labels are white, the numbers are the OnePlus
        // red. The direction is carried by the sign and by the label text
        // ("NET LENT" / "NET DEBIT").
        private val VALUE = Color.parseColor("#EB0028")

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

        var spend = "—"
        var cards = "—"
        var bank = "—"
        var lent = "—"
        var lentLabel = "NET LENT"
        var tasks = "—"
        var wealth = "—"
        var marketChange = "—"
        var marketValue = "—"
        // The nearest tasks: id, name and whether they are done.
        val upcoming = mutableListOf<Triple<String, String, Boolean>>()

        if (!json.isNullOrEmpty()) {
            try {
                val o = JSONObject(json)

                if (o.has("monthlySpendPaise")) {
                    spend = formatMoney(o.getLong("monthlySpendPaise"))
                }
                if (o.has("ccBillsPaise")) {
                    cards = formatMoney(o.getLong("ccBillsPaise"))
                }
                if (o.has("bankBalancePaise")) {
                    bank = formatMoney(o.getLong("bankBalancePaise"))
                }
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
                    if (left == 0) {
                        tasks = "✓"
                    } else {
                        tasks = left.toString()
                    }
                }
                if (o.has("netWorthPaise")) {
                    wealth = formatMoney(o.getLong("netWorthPaise"))
                }
                if (o.has("dayChangePaise")) {
                    val change = o.getLong("dayChangePaise")
                    val pct = o.optDouble("dayChangePct", 0.0)
                    val sign = if (change < 0) "-" else "+"
                    marketChange = "$sign${formatMoney(kotlin.math.abs(change))} ($sign${String.format(Locale.US, "%.1f", kotlin.math.abs(pct))}%)"
                }
                if (o.has("portfolioValuePaise")) {
                    marketValue = "NET ${formatMoney(o.getLong("portfolioValuePaise"))}"
                }
                if (o.has("upcomingTasks")) {
                    val array = o.optJSONArray("upcomingTasks")
                    for (i in 0 until (array?.length() ?: 0)) {
                        val t = array?.optJSONObject(i) ?: continue
                        val id = t.optString("id")
                        val name = t.optString("name")
                        if (id.isEmpty() || name.isEmpty()) continue
                        upcoming.add(Triple(id, name, t.optBoolean("done", false)))
                        if (upcoming.size >= 2) break
                    }
                }
            } catch (_: Exception) {
                // Malformed payload → keep placeholders
            }
        }

        views.setTextViewText(R.id.stats_spend, spend)
        views.setTextViewText(R.id.stats_cards, cards)
        views.setTextViewText(R.id.stats_bank, bank)
        views.setTextViewText(R.id.stats_lent, lent)
        views.setTextViewText(R.id.stats_lent_label, lentLabel)
        views.setTextColor(R.id.stats_lent, VALUE)
        views.setTextColor(R.id.stats_tasks, VALUE)
        views.setTextViewText(R.id.stats_wealth, wealth)
        views.setTextViewText(R.id.stats_market_change, marketChange)
        views.setTextColor(R.id.stats_market_change, VALUE)
        views.setTextViewText(R.id.stats_market_value, marketValue)
        views.setTextColor(R.id.stats_market_value, MUTED)

        // The tasks card: the header with the count and the nearest 2 tasks.
        // It sits in the flipper twice, so both copies are filled.
        views.setTextViewText(R.id.stats_tasks, tasks)
        views.setTextViewText(R.id.stats_tasks_b, tasks)
        bindTasks(
            views, context, upcoming,
            intArrayOf(R.id.stats_task_circle_1, R.id.stats_task_circle_2),
            intArrayOf(R.id.stats_task_name_1, R.id.stats_task_name_2),
            intArrayOf(R.id.stats_task_row_1, R.id.stats_task_row_2)
        )
        bindTasks(
            views, context, upcoming,
            intArrayOf(R.id.stats_task_circle_1_b, R.id.stats_task_circle_2_b),
            intArrayOf(R.id.stats_task_name_1_b, R.id.stats_task_name_2_b),
            intArrayOf(R.id.stats_task_row_1_b, R.id.stats_task_row_2_b)
        )

        views.setOnClickPendingIntent(R.id.stats_card_spend, deepLink(context, "meridian://monthly-spend"))
        views.setOnClickPendingIntent(R.id.stats_card_cards, deepLink(context, "meridian://credit-cards"))
        views.setOnClickPendingIntent(R.id.stats_card_bank, deepLink(context, "meridian://bank-accounts"))
        views.setOnClickPendingIntent(R.id.stats_card_lent, deepLink(context, "meridian://lent-borrowed"))
        views.setOnClickPendingIntent(R.id.stats_card_tasks, deepLink(context, "meridian://tasks"))
        views.setOnClickPendingIntent(R.id.stats_card_tasks_b, deepLink(context, "meridian://tasks"))
        views.setOnClickPendingIntent(R.id.stats_card_wealth, deepLink(context, "meridian://wealth"))
        views.setOnClickPendingIntent(R.id.stats_card_market, deepLink(context, "meridian://wealth"))

        return views
    }

    /**
     * Fill the two task rows: the circle (tap → mark as done) and the name
     * (tap → open the task).
     */
    private fun bindTasks(
        views: RemoteViews,
        context: Context,
        upcoming: List<Triple<String, String, Boolean>>,
        circleIds: IntArray,
        nameIds: IntArray,
        rowIds: IntArray
    ) {
        for (index in 0..1) {
            val task = upcoming.getOrNull(index)
            if (task == null) {
                views.setViewVisibility(rowIds[index], View.GONE)
                continue
            }
            val (id, name, done) = task
            views.setViewVisibility(rowIds[index], View.VISIBLE)
            views.setTextViewText(nameIds[index], name)
            views.setImageViewResource(
                circleIds[index],
                if (done) R.drawable.widget_task_circle_done else R.drawable.widget_task_circle
            )
            if (done) {
                // A finished task cannot be ticked again.
                views.setOnClickPendingIntent(circleIds[index], deepLink(context, "meridian://tasks"))
            } else {
                views.setOnClickPendingIntent(
                    circleIds[index],
                    deepLink(context, "meridian://task-complete/$id")
                )
            }
            views.setOnClickPendingIntent(nameIds[index], deepLink(context, "meridian://task/$id"))
        }
    }

    /** Paise → "₹845" or "₹1.2k" (no locale-dependent grouping). */
    private fun formatMoney(paise: Long): String {
        val rupees = paise / 100.0
        return if (rupees >= 1000) {
            String.format(Locale.US, "₹%.1fk", rupees / 1000.0)
        } else {
            String.format(Locale.US, "₹%d", Math.round(rupees))
        }
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
