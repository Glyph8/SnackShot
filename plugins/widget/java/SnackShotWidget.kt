package com.glyph8.snackshot

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/**
 * SnackShot 홈 화면 위젯.
 * 빨간 원형 버튼 탭 → snackshot://record 딥링크로 MainActivity 기동,
 * expo-router가 /record 화면으로 라우팅한다.
 */
class SnackShotWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.snackshot_widget)

        // 딥링크 Intent: snackshot://record → MainActivity → expo-router /record
        val intent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("snackshot://record")
            setClassName(context, "com.glyph8.snackshot.MainActivity")
            // 앱이 백그라운드에 있어도 최상위로 올라오게
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        // FLAG_IMMUTABLE 필수 (Android 12+ / API 31+)
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        views.setOnClickPendingIntent(R.id.widget_record_btn, pendingIntent)
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
