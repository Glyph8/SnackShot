package com.glyph8.snackshot

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.quicksettings.TileService

/**
 * 빠른 설정 타일 — 잠금화면에서 위로 스와이프해 접근 가능.
 * 탭 시 딥링크로 MainActivity 기동(잠금 상태면 해제 후 실행), expo-router가 해당 화면으로 라우팅.
 */
abstract class SnackShotTileService : TileService() {
    abstract val deepLink: String

    override fun onClick() {
        super.onClick()
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply {
            setClassName(this@SnackShotTileService, "com.glyph8.snackshot.MainActivity")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        // Android 14(API 34)+ 는 PendingIntent 오버로드 사용
        if (Build.VERSION.SDK_INT >= 34) {
            val pi = PendingIntent.getActivity(
                this, 0, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            startActivityAndCollapse(pi)
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }
}

class RecordVideoTileService : SnackShotTileService() {
    override val deepLink = "snackshot://record"
}

class RecordAudioTileService : SnackShotTileService() {
    override val deepLink = "snackshot://record-audio"
}
