/**
 * 영상에서 오디오 트랙만 추출(remux)하는 네이티브 모듈 래퍼.
 *
 * Whisper STT의 25MB 업로드 한도 회피용 — 영상 원본은 오디오만 떼어 작은 .m4a로 보낸다.
 * 네이티브 모듈(AudioExtractor)이 없거나 실패하면 null을 반환해 호출자가 원본으로 폴백한다.
 *
 * 네이티브: plugins/native/AudioExtractorModule.kt (MediaExtractor + MediaMuxer)
 */
import { File, Paths } from 'expo-file-system';
import { NativeModules } from 'react-native';

interface AudioExtractorNative {
  extractAudio(srcUri: string, dstUri: string): Promise<string>;
}

const native = (NativeModules as Record<string, unknown>).AudioExtractor as
  | AudioExtractorNative
  | undefined;

/**
 * 영상 오디오 트랙만 캐시에 작은 m4a로 추출. 성공 시 uri, 실패/미지원 시 null.
 */
export async function extractAudioForStt(srcUri: string, entryId: string): Promise<string | null> {
  if (!native?.extractAudio) return null;
  try {
    const dst = new File(Paths.cache, `stt_${entryId}.m4a`);
    if (dst.exists) dst.delete();
    await native.extractAudio(srcUri, dst.uri);
    return dst.exists && (dst.size ?? 0) > 0 ? dst.uri : null;
  } catch (e) {
    console.warn('[stt] 오디오 추출 실패 — 원본으로 폴백', e);
    return null;
  }
}

/** 추출한 임시 오디오 정리 (전사 후 호출). */
export function cleanupSttAudio(uri: string | null): void {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // 정리 실패는 무시 (캐시 파일)
  }
}
