package com.glyph8.snackshot

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * SnackShot 홈 화면 위젯 — "오늘 일기" 캡처 바.
 * 영상/음성/직접쓰기 버튼 탭 → 딥링크로 MainActivity 기동, expo-router가 해당 화면으로 라우팅.
 *   영상     → snackshot://record
 *   음성     → snackshot://record-audio
 *   직접쓰기 → snackshot://compose-text
 *
 * 헤더 메타("M/d · N개")의 개수는 SharedPreferences("snackshot_widget", key="today_count")에서 읽는다.
 * 앱이 값을 기록하지 않았으면(-1) 날짜만 표시한다.
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

    private fun deepLink(context: Context, uri: String, requestCode: Int): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse(uri)
            setClassName(context, "com.glyph8.snackshot.MainActivity")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        // FLAG_IMMUTABLE 필수 (API 31+), requestCode를 달리해 버튼별 PendingIntent 구분
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.snackshot_widget)

        // 헤더 메타: 오늘 날짜 + (있으면) 개수
        val dateStr = SimpleDateFormat("M/d", Locale.getDefault()).format(Date())
        val count = context
            .getSharedPreferences("snackshot_widget", Context.MODE_PRIVATE)
            .getInt("today_count", -1)
        views.setTextViewText(
            R.id.widget_meta,
            if (count >= 0) "$dateStr · ${count}개" else dateStr,
        )

        // 버튼별 딥링크 연결
        views.setOnClickPendingIntent(R.id.widget_btn_video, deepLink(context, "snackshot://record", 0))
        views.setOnClickPendingIntent(R.id.widget_btn_audio, deepLink(context, "snackshot://record-audio", 1))
        views.setOnClickPendingIntent(R.id.widget_btn_text, deepLink(context, "snackshot://compose-text", 2))

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
