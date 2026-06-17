// 잡 제어 흐름 신호 (실패 아님). 핸들러가 throw하고 queue.ts가 분기 처리한다.
// INV-no-class 예외: Error 서브클래스.

// 의존 조건 미충족 시 재예약용 에러 — 실패 카운트를 소모하지 않음
export class RescheduleError extends Error {
  constructor(public readonly delayMs: number, message: string) {
    super(message);
    this.name = 'RescheduleError';
  }
}

// vault 미연결 등 재시도 불필요 시 잡을 cancelled로 전환
export class CancelJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CancelJobError';
  }
}
