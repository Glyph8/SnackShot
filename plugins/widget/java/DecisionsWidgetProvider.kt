package com.glyph8.snackshot

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * 의사결정 리스트 위젯 — 진행 중 결정 조회 + 행 탭으로 수행 완료 체크 + 추가/새로고침.
 *
 * 데이터: 앱이 context.filesDir/snackshot_widget.json 로 내보낸다(services/widget/widgetSync.ts).
 * 체크: 행 탭 → ACTION_CHECK 브로드캐스트 → pending 파일 적재 + 로컬 JSON 즉시 제거 + 새로고침.
 *       앱이 포그라운드로 오면 pending을 SQLite(markDecisionExecuted)에 반영한다.
 */
class DecisionsWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_CHECK = "com.glyph8.snackshot.WIDGET_CHECK"
        const val ACTION_REFRESH = "com.glyph8.snackshot.WIDGET_REFRESH"
        const val EXTRA_ID = "decision_id"
        const val DATA_FILE = "snackshot_widget.json"
        const val PENDING_FILE = "snackshot_widget_pending.json"
    }

    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        for (id in ids) updateWidget(context, mgr, id)
    }

    private fun updateWidget(context: Context, mgr: AppWidgetManager, widgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.snackshot_decisions_widget)

        // 리스트 어댑터 — 위젯별 고유 data URI로 구분
        val svc = Intent(context, DecisionsWidgetService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
        }
        @Suppress("DEPRECATION")
        views.setRemoteAdapter(R.id.widget_list, svc)
        views.setEmptyView(R.id.widget_list, R.id.widget_empty)

        // 추가 → compose-decision 딥링크
        views.setOnClickPendingIntent(
            R.id.widget_add,
            deepLink(context, "snackshot://compose-decision", 1000 + widgetId),
        )
        // 새로고침 → self ACTION_REFRESH
        views.setOnClickPendingIntent(R.id.widget_refresh, broadcast(context, ACTION_REFRESH, 2000 + widgetId))

        // 행 탭 템플릿 → ACTION_CHECK (fillInIntent로 id 주입)
        val template = Intent(context, DecisionsWidgetProvider::class.java).apply { action = ACTION_CHECK }
        val templatePi = PendingIntent.getBroadcast(
            context, 3000, template,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
        )
        views.setPendingIntentTemplate(R.id.widget_list, templatePi)

        mgr.updateAppWidget(widgetId, views)
        mgr.notifyAppWidgetViewDataChanged(widgetId, R.id.widget_list)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_CHECK -> {
                val id = intent.getStringExtra(EXTRA_ID)
                if (!id.isNullOrEmpty()) toggleDone(context, id)
                refreshAll(context)
            }
            ACTION_REFRESH -> refreshAll(context)
        }
    }

    private fun refreshAll(context: Context) {
        val mgr = AppWidgetManager.getInstance(context)
        val ids = mgr.getAppWidgetIds(ComponentName(context, DecisionsWidgetProvider::class.java))
        for (id in ids) updateWidget(context, mgr, id)
    }

    private fun deepLink(context: Context, uri: String, req: Int): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
            setClassName(context, "com.glyph8.snackshot.MainActivity")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            context, req, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun broadcast(context: Context, action: String, req: Int): PendingIntent {
        val intent = Intent(context, DecisionsWidgetProvider::class.java).apply { this.action = action }
        return PendingIntent.getBroadcast(
            context, req, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    // 로컬 JSON에서 해당 항목의 done을 토글(제거하지 않음 → 완료 상태로 남음) + pending 적재
    private fun toggleDone(context: Context, id: String) {
        var newDone = true
        val f = File(context.filesDir, DATA_FILE)
        if (f.exists()) {
            try {
                val obj = JSONObject(f.readText())
                val arr = obj.optJSONArray("decisions")
                if (arr != null) {
                    for (i in 0 until arr.length()) {
                        val item = arr.getJSONObject(i)
                        if (item.optString("id") == id) {
                            newDone = !item.optBoolean("done", false)
                            item.put("done", newDone)
                            break
                        }
                    }
                    obj.put("decisions", arr)
                    f.writeText(obj.toString())
                }
            } catch (e: Exception) {}
        }
        appendPending(context, id, if (newDone) "check" else "uncheck")
    }

    private fun appendPending(context: Context, id: String, action: String) {
        val f = File(context.filesDir, PENDING_FILE)
        val arr = try { if (f.exists()) JSONArray(f.readText()) else JSONArray() } catch (e: Exception) { JSONArray() }
        arr.put(JSONObject().put("id", id).put("action", action))
        try { f.writeText(arr.toString()) } catch (e: Exception) {}
    }
}
