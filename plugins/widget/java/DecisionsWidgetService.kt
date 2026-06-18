package com.glyph8.snackshot

import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import org.json.JSONObject
import java.io.File

/** 의사결정 리스트 위젯의 컬렉션 어댑터 — snackshot_widget.json을 읽어 행을 그린다. */
class DecisionsWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory =
        DecisionsFactory(applicationContext)
}

private class DecisionsFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {

    private data class Row(val id: String, val title: String, val category: String, val done: Boolean)
    private var rows: List<Row> = emptyList()

    override fun onCreate() {}
    override fun onDataSetChanged() { rows = load() }
    override fun onDestroy() { rows = emptyList() }
    override fun getCount(): Int = rows.size
    override fun getViewTypeCount(): Int = 1
    override fun getItemId(position: Int): Long = position.toLong()
    override fun hasStableIds(): Boolean = false
    override fun getLoadingView(): RemoteViews? = null

    override fun getViewAt(position: Int): RemoteViews {
        val rv = RemoteViews(context.packageName, R.layout.snackshot_decision_row)
        if (position < 0 || position >= rows.size) return rv
        val row = rows[position]
        rv.setTextViewText(R.id.row_title, row.title)
        rv.setTextViewText(R.id.row_category, row.category)
        // 체크 상태: 완료 = 채운 체크 + 흐린 제목 / 진행 중 = 빈 원 + 진한 제목
        rv.setImageViewResource(
            R.id.row_check,
            if (row.done) R.drawable.ic_widget_check else R.drawable.ic_widget_circle,
        )
        rv.setTextColor(
            R.id.row_title,
            context.getColor(if (row.done) R.color.widget_meta else R.color.widget_text),
        )
        // 행 탭 → 토글 (템플릿에 id 주입)
        val fill = Intent().apply { putExtra(DecisionsWidgetProvider.EXTRA_ID, row.id) }
        rv.setOnClickFillInIntent(R.id.row_root, fill)
        return rv
    }

    private fun load(): List<Row> {
        val f = File(context.filesDir, DecisionsWidgetProvider.DATA_FILE)
        if (!f.exists()) return emptyList()
        return try {
            val arr = JSONObject(f.readText()).optJSONArray("decisions") ?: return emptyList()
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                Row(o.optString("id"), o.optString("title"), o.optString("category"), o.optBoolean("done", false))
            }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
