/**
 * 결정 추출 프롬프트 (ADR-027).
 *
 * 이 파일이 프롬프트의 single source of truth다 — settings 오버라이드 없음.
 * 문구를 바꾸면 git이 이력을 추적한다 (ADR-027의 결정).
 *
 * 의존성 없음 — gemini.ts가 import하여 systemInstruction/contents로 변환한다.
 * FEW_SHOT_EXAMPLES의 model 값은 JSON.stringify로 생성되므로 항상 유효한 JSON.
 */

export const DECISION_EXTRACTION_SYSTEM_PROMPT = `너는 영상 일기 앱의 "의사결정 추출기"다. 사용자가 혼잣말로 녹화한 일기의 음성 전사를 읽고, 그 안에 "나중에 결과를 추적할 가치가 있는 의사결정"이 있는지 판별해 JSON으로만 응답한다.

전사는 한국어 구어체다. 반말, 줄임말, 비문, STT 오인식이 섞여 있다. 표현이 아니라 내용으로 판단하라.

## 결정의 정의 — 세 가지를 모두 만족해야 결정이다
1. **미래 행동이 명시된다**: 화자가 앞으로 무엇을 하기로(또는 하지 않기로) 정했다. 과거형으로 말해도("~하기로 했어") 행동이 아직 미래면 결정이다.
2. **대안이 존재한다**: 다른 선택지가 언급되었거나, 최소한 "안 하는 선택"이 실재했다.
3. **결과를 검증할 수 있다**: 나중에 "그 결정이 좋았는지"를 판단할 시점과 기준을 상상할 수 있다.

## 결정이 아닌 것 — 절대 추출하지 마라
- 감상·기분: "오늘 날씨 좋았다", "피곤하다"
- 과거 회상: 이미 끝난 일의 서술
- 이미 완료된 즉시 행동: "방금 점심 먹었다"
- 추상적 다짐: "더 열심히 살아야지", "운동 좀 해야 하는데" — 구체적 행동·시점이 없으면 다짐이지 결정이 아니다
- 타인의 결정: 화자 본인의 결정만 추출한다

## 출력 규칙
- evidence는 **전사 원문에서 그대로 복사한 연속 문자열**이어야 한다. 바꿔 쓰거나 요약하지 마라. 코드가 원문 포함 여부를 검사하며 불일치 시 해당 후보는 폐기된다.
- summary는 한 문장, "~하기로 함" 형태로.
- situation은 이 결정이 나온 **상황·맥락**(배경·계기)을 한 문장으로. 전사에 드러난 사실에 근거하되 요약해도 된다. evidence처럼 원문 복사일 필요는 없다.
- confidence: 세 요건이 모두 명시적이면 0.8 이상, 일부가 암묵적이면 0.5~0.7, 해석에 크게 의존하면 0.5 미만.
- followUpAfterDays: 결과를 확인하기 적절한 일수. 기준 — 투자 7~30, 일상 습관 2~3, 커리어 30~90, 관계 7~14. 결정 내용에 맞게 조정하고, 검증 시점을 정할 수 없으면 null.
- 결정이 없으면 hasDecision=false, decisions=[].
- 한 전사에 결정이 여러 개면 모두 추출하되, 같은 결정의 반복 언급은 1개로 합친다.
- 모든 텍스트 필드는 한국어로 쓴다.`;

// ─── Few-shot 예시 (긍정 2, 부정 1) ─────────────────────────────────────────
// gemini.ts가 contents 배열의 user/model 턴으로 변환한다.

const EX1_USER = `[전사] 어 오늘 점심 먹다가 생각해봤는데 삼성전자 지금 들어가는 건 좀 아닌 것 같아. 실적 발표가 다음 달이니까 그거 보고 결정하기로 했어. 지금 사고 싶긴 한데 참는다.`;

const EX1_MODEL = {
  hasDecision: true,
  decisions: [
    {
      summary: '삼성전자 매수를 다음 달 실적 발표까지 보류하기로 함',
      category: 'investment',
      situation: '삼성전자 매수를 고민 중이나 다음 달 실적 발표를 앞두고 진입 시점에 확신이 없는 상황',
      reasoning: '현재 진입 시점에 확신이 없고, 한 달 뒤 실적 발표가 더 나은 판단 근거가 된다고 봄',
      alternatives: '지금 즉시 매수',
      expectedOutcome: '실적 확인 후 더 유리한 진입 여부를 판단할 수 있음',
      evidence: '실적 발표가 다음 달이니까 그거 보고 결정하기로 했어',
      confidence: 0.9,
      followUpAfterDays: 30,
    },
  ],
};

const EX2_USER = `[전사] 요즘 계속 새벽 두 시에 자네. 안 되겠다, 내일부터는 열두 시 전에 누울 거야. 알람을 열한 시 반에 맞춰놨어.`;

const EX2_MODEL = {
  hasDecision: true,
  decisions: [
    {
      summary: '내일부터 자정 전에 취침하기로 함',
      category: 'daily',
      situation: '최근 계속 새벽 2시에 잠들어 수면 패턴이 무너진 상황',
      reasoning: '새벽 2시 취침이 반복되어 수면 패턴을 바꾸기로 함',
      alternatives: '기존 수면 패턴 유지',
      expectedOutcome: '며칠 내 취침 시각이 자정 전으로 당겨짐',
      evidence: '내일부터는 열두 시 전에 누울 거야',
      confidence: 0.8,
      followUpAfterDays: 3,
    },
  ],
};

const EX3_USER = `[전사] 아 오늘 진짜 힘들었다. 회의만 네 개 했나. 운동도 좀 해야 되는데 말이야. 아무튼 뭐 그런 하루였습니다.`;

const EX3_MODEL = {
  hasDecision: false,
  decisions: [],
};

export const FEW_SHOT_EXAMPLES: ReadonlyArray<{ user: string; model: string }> = [
  { user: EX1_USER, model: JSON.stringify(EX1_MODEL) },
  { user: EX2_USER, model: JSON.stringify(EX2_MODEL) },
  { user: EX3_USER, model: JSON.stringify(EX3_MODEL) },
];

// ─── 사용자 메시지 빌더 ──────────────────────────────────────────────────────

export function buildUserMessage(
  transcript: string,
  hints: {
    userDecisionHint: boolean;
    recordedAtIso: string;
    durationSec: number;
  },
): string {
  const lines = [
    `[녹화 시각] ${hints.recordedAtIso}`,
    `[길이] ${Math.round(hints.durationSec)}초`,
  ];
  if (hints.userDecisionHint) {
    lines.push('[힌트] 사용자가 이 클립에 중요한 결정이 있다고 직접 표시했다. 기준은 동일하게 적용하되 더 주의 깊게 찾아보라.');
  }
  lines.push('', `[전사] ${transcript}`);
  return lines.join('\n');
}
