import { File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getEntry, insertTranscript, updateSttStatus } from '@/db';
import { getSttService } from '@/services/stt';
import { cleanupSttAudio, extractAudioForStt } from '@/services/stt/extractAudio';
import type { AiJob } from '@/types/domain';

/**
 * STT 핸들러 (ADR-007: 클립별 즉시 처리, ADR-002: 인터페이스 추상화).
 * silent 모드 클립은 건너뜀.
 *
 * 오디오 소스: originalPath 사용.
 * react-native-compressor의 manual 모드가 일부 Android 기기에서
 * 오디오 트랙을 누락시키는 문제가 확인됨 (Whisper 응답 seconds=0).
 * 압축본은 재생/저장 전용이고, 전사는 원본을 쓴다.
 *
 * stt_status 전이: processing → done (성공) / skipped (silent).
 * 영구 실패 시 'failed'는 queue.ts의 markEntryFailed가 갱신한다.
 */
export async function handleStt(job: AiJob, db: SQLiteDatabase): Promise<void> {
  const entry = await getEntry(db, job.targetId);
  if (!entry) throw new Error(`entry not found: ${job.targetId}`);

  // silent 모드 — 음성이 없으므로 STT 불필요 (방어적으로 'skipped' 기록)
  if (entry.mode === 'silent') {
    console.log(`[stt] skip silent id=${entry.id}`);
    await updateSttStatus(db, entry.id, 'skipped');
    return;
  }

  // text 모드 — 음성 트랙 자체가 없으므로 STT 불필요 (정상 흐름이면 enqueue되지 않지만 방어).
  if (entry.mode === 'text') {
    console.log(`[stt] skip text id=${entry.id}`);
    await updateSttStatus(db, entry.id, 'skipped');
    return;
  }

  await updateSttStatus(db, entry.id, 'processing');

  // 원본 파일 존재 확인 — 녹화 직후 항상 생성되므로 누락이면 심각한 오류
  const audioFile = new File(entry.originalPath);
  if (!audioFile.exists) throw new Error(`original audio not found: ${entry.originalPath}`);
  console.log(`[stt] start id=${entry.id} size=${audioFile.size}B`);

  // 영상(voice)은 오디오 트랙만 추출해 전송 — Whisper 25MB 한도 회피.
  // audio 모드는 이미 작은 .m4a, 추출 실패 시엔 원본으로 폴백한다.
  let sttSource = entry.originalPath;
  let tempAudio: string | null = null;
  if (entry.mode === 'voice') {
    tempAudio = await extractAudioForStt(entry.originalPath, entry.id);
    if (tempAudio) {
      sttSource = tempAudio;
      console.log(`[stt] 오디오 추출 사용 id=${entry.id} size=${new File(tempAudio).size}B`);
    }
  }

  try {
    const sttService = getSttService();
    const result = await sttService.transcribe(sttSource);
    const { name: engine, version: engineVersion } = sttService.getEngineInfo();

    // 환각 필터 후 본문이 비면 = 사실상 무음 → 'skipped'(음성 없음). 빈 transcript는 만들지 않음.
    if (!result.text.trim()) {
      await updateSttStatus(db, entry.id, 'skipped');
      console.log(`[stt] no speech → skipped id=${entry.id}`);
      return;
    }

    // 비용 로그는 whisper.ts가 API 응답 duration 기준으로 출력하므로 여기선 결과 요약만
    console.log(
      `[stt] done id=${entry.id} lang=${result.language} chars=${result.text.length}`,
    );

    await insertTranscript(db, {
      entryId: entry.id,
      rawText: result.text,
      engine,
      engineVersion,
      language: result.language,
      confidence: result.confidence,
      segmentsJson: result.segments ? JSON.stringify(result.segments) : undefined,
    });

    await updateSttStatus(db, entry.id, 'done');
  } finally {
    cleanupSttAudio(tempAudio);
  }
}
