package com.glyph8.snackshot

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/** 소형 '의사결정 추가' 위젯 — 탭하면 compose-decision 작성 화면으로 딥링크. */
class DecisionAddWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        for (id in ids) {
            val views = RemoteViews(context.packageName, R.layout.snackshot_decision_add_widget)
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("snackshot://compose-decision")).apply {
                setClassName(context, "com.glyph8.snackshot.MainActivity")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pi = PendingIntent.getActivity(
                context, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.add_root, pi)
            mgr.updateAppWidget(id, views)
        }
    }
}
