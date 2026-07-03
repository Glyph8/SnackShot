// FTS5 전방 일치 쿼리 빌더 — transcripts_fts / decisions_fts 공용 (D1에서 추출).
//
// FTS5 특수문자를 정리하고 각 단어 끝에 * 를 붙여 전방 일치 검색으로 변환한다.
// 예: "삼성 전자" → "삼성* 전자*" (삼성전자도 매칭)
// unicode61 토크나이저는 한국어 조사가 붙은 어절을 하나의 토큰으로 처리하므로,
// prefix(*) 매칭으로 "이직을"·"이직은"을 "이직*"으로 함께 잡는다(함정 목록 #2).
export function buildFtsQuery(raw: string): string | null {
  const clean = raw
    .trim()
    .replace(/[":*^()\[\]{}\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;
  return clean
    .split(' ')
    .filter(Boolean)
    .map((t) => `${t}*`)
    .join(' ');
}
