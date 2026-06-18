package com.glyph8.snackshot

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.nio.ByteBuffer

/**
 * 영상(.mp4)에서 오디오 트랙만 remux 추출 → 작은 .m4a 생성.
 * Whisper STT 25MB 업로드 한도 회피용 — 영상 트랙(용량의 대부분)을 떼어내고 오디오만 보낸다.
 * 재인코딩 없이 트랙 복사라 빠르고 무손실이다.
 */
class AudioExtractorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AudioExtractor"

    @ReactMethod
    fun extractAudio(srcUri: String, dstUri: String, promise: Promise) {
        try {
            val srcPath = toPath(srcUri)
            val dstPath = toPath(dstUri)
            if (remux(srcPath, dstPath)) {
                promise.resolve(dstUri)
            } else {
                promise.reject("no_audio", "오디오 트랙을 찾을 수 없습니다")
            }
        } catch (e: Exception) {
            promise.reject("extract_failed", e.message, e)
        }
    }

    private fun toPath(uri: String): String =
        if (uri.startsWith("file://")) (Uri.parse(uri).path ?: uri.removePrefix("file://")) else uri

    private fun remux(srcPath: String, dstPath: String): Boolean {
        val extractor = MediaExtractor()
        var muxer: MediaMuxer? = null
        try {
            extractor.setDataSource(srcPath)

            var audioTrack = -1
            var format: MediaFormat? = null
            for (i in 0 until extractor.trackCount) {
                val f = extractor.getTrackFormat(i)
                val mime = f.getString(MediaFormat.KEY_MIME) ?: continue
                if (mime.startsWith("audio/")) {
                    audioTrack = i
                    format = f
                    break
                }
            }
            if (audioTrack < 0 || format == null) return false

            extractor.selectTrack(audioTrack)
            File(dstPath).parentFile?.mkdirs()
            File(dstPath).takeIf { it.exists() }?.delete()

            muxer = MediaMuxer(dstPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            val outTrack = muxer.addTrack(format)
            muxer.start()

            val buffer = ByteBuffer.allocate(1 shl 20) // 1MB
            val info = MediaCodec.BufferInfo()
            while (true) {
                val size = extractor.readSampleData(buffer, 0)
                if (size < 0) break
                info.offset = 0
                info.size = size
                info.presentationTimeUs = extractor.sampleTime
                info.flags = if (extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0)
                    MediaCodec.BUFFER_FLAG_KEY_FRAME else 0
                muxer.writeSampleData(outTrack, buffer, info)
                extractor.advance()
            }
            muxer.stop()
            return true
        } finally {
            try { muxer?.release() } catch (e: Exception) {}
            extractor.release()
        }
    }
}
