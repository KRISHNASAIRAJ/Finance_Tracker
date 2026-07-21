package com.krishnasairaj.meridian.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.krishnasairaj.meridian.MainActivity

data class WidgetConfig(
    val label: String,
    val iconRes: Int,
    val deepLink: String
)

open class BaseQuickActionWidget(
    private val label: String,
    private val iconRes: Int,
    private val deepLink: String
) : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, com.krishnasairaj.meridian.R.layout.widget_quick_action)
        views.setTextViewText(com.krishnasairaj.meridian.R.id.widget_label, label)
        views.setImageViewResource(com.krishnasairaj.meridian.R.id.widget_icon, iconRes)
        views.setOnClickPendingIntent(
            com.krishnasairaj.meridian.R.id.widget_container,
            createClickIntent(context)
        )
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun createClickIntent(context: Context): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse(deepLink)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            context,
            deepLink.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}

// ---- Concrete widget classes ----

class AddExpenseWidget : BaseQuickActionWidget(
    label = "Add Expense",
    iconRes = com.krishnasairaj.meridian.R.drawable.widget_add_expense,
    deepLink = "meridian://add-expense"
)

class AddFuelWidget : BaseQuickActionWidget(
    label = "Add Fuel",
    iconRes = com.krishnasairaj.meridian.R.drawable.widget_add_fuel,
    deepLink = "meridian://add-fuel"
)

class AddTaskWidget : BaseQuickActionWidget(
    label = "Add Task",
    iconRes = com.krishnasairaj.meridian.R.drawable.widget_add_task,
    deepLink = "meridian://add-task"
)

class CombinedReportWidget : BaseQuickActionWidget(
    label = "Report",
    iconRes = com.krishnasairaj.meridian.R.drawable.widget_combined_report,
    deepLink = "meridian://combined-report"
)
