/**
 * 백그라운드 잡 실패 분류 (ADR-012 보완).
 *
 * 원시 에러 메시지를 사용자 친화적 "왜/어디서/어떻게"로 매핑한다.
 * 워커 로그와 UI(상세 화면 실패 카드) 양쪽에서 공유한다.
 */
import type { AiJobType } from '@/types/domain';

export type JobFailKind =
  | 'rateLimit' | 'auth' | 'noKey' | 'network'
  | 'fileMissing' | 'permission' | 'timeout' | 'unknown';

/** 어디서(단계) */
export const JOB_STAGE_LABEL: Record<AiJobType, string> = {
  compression: '영상 압축',
  stt: '음성 인식',
  label_extraction: '결정 추출',
  obsidian_export: '옵시디언 내보내기',
  outcome_followup: '후속 확인',
  original_backup: '원본 백업',
  obsidian_import: '옵시디언 가져오기',
  quote_fetch: '시세 조회',
};

export interface ClassifiedError {
  kind: JobFailKind;
  /** 왜 — 한 줄 원인 */
  why: string;
  /** 어떻게 — 권장 조치 */
  how: string;
  /** 자동 재시도로 해결 가능한지(일시적) */
  retryable: boolean;
}

export function classifyJobError(raw: string | undefined, jobType: AiJobType): ClassifiedError {
  const msg = (raw ?? '').toLowerCase();
  const stage = JOB_STAGE_LABEL[jobType];

  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many')) {
    return { kind: 'rateLimit', why: '요청이 많아 일시적으로 제한됐어요', how: '잠시 후 자동으로 다시 시도합니다.', retryable: true };
  }
  if (msg.includes('미설정') || msg.includes('no key') || msg.includes('api key가') || msg.includes('키 미설정')) {
    return { kind: 'noKey', why: `${stage}에 필요한 API 키가 없어요`, how: '설정 → API 키에서 키를 등록하세요.', retryable: false };
  }
  if (msg.includes('401') || msg.includes('403') || msg.includes('invalid api key') || msg.includes('unauthorized') || msg.includes('api key')) {
    return { kind: 'auth', why: 'API 키 인증에 실패했어요', how: '설정에서 키가 올바른지 확인 후 다시 시도하세요.', retryable: false };
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('econn') || msg.includes('enotfound') || msg.includes('failed to fetch')) {
    return { kind: 'network', why: '네트워크 연결에 문제가 있었어요', how: '연결을 확인한 뒤 다시 시도하세요.', retryable: true };
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return { kind: 'timeout', why: '응답이 너무 오래 걸렸어요', how: '잠시 후 다시 시도하세요.', retryable: true };
  }
  if (msg.includes('not found') || msg.includes('no such file') || msg.includes('does not exist') || msg.includes('audio not found')) {
    return { kind: 'fileMissing', why: '원본 파일을 찾을 수 없어요', how: '원본이 삭제되었을 수 있어 복구가 어려울 수 있어요.', retryable: false };
  }
  if (msg.includes('vault') || msg.includes('권한') || msg.includes('permission') || msg.includes('saf')) {
    return { kind: 'permission', why: '저장소 접근 권한이 만료됐어요', how: '설정에서 옵시디언 폴더를 다시 연결하세요.', retryable: true };
  }
  return { kind: 'unknown', why: `${stage} 중 알 수 없는 오류가 발생했어요`, how: '다시 시도해도 계속되면 잠시 후 시도하세요.', retryable: true };
}
