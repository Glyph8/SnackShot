#!/usr/bin/env bash
#
# INVARIANTS.md 자동 검사 — 오탐 0(zero-false-positive) 부분집합만 하드 게이트.
# 진실원: 루트 INVARIANTS.md. 규칙을 추가/변경하면 INVARIANTS.md와 이 파일을 함께 갱신한다.
#
# soft-delete / UTC-ms 등 멀티라인·문맥 의존 규칙은 오탐 위험이 있어 여기서 강제하지 않고
# qa-engineer의 육안 검증에 맡긴다(INVARIANTS.md "허용 예외" 참조).
#
# 매치(=위반)가 있으면 비정상 종료(exit 1). grep 실행 오류(잘못된 경로/패턴)는 exit 2.

set -euo pipefail
cd "$(dirname "$0")/.."

# 잘못된 위치에서 실행되면 grep이 조용히 실패해 전 항목이 가짜 통과하므로 선제 차단.
[ -d src ] && [ -d app ] || { echo '✗ src/app 디렉토리 없음 — 저장소 루트가 아니다' >&2; exit 2; }

# grep 래퍼: exit 0(매치)→위반 라인 출력, 1(무매치)→빈 출력, 2+(실행 오류)→하드 실패.
# 종전에는 grep 오류도 빈 문자열 → ✓ 통과로 처리되는 조용한 오탐이 있었다.
g() {
  local out code=0
  out=$(grep "$@") || code=$?
  if [ "$code" -ge 2 ]; then
    printf '✗ grep 실행 오류(exit %d): grep %s\n' "$code" "$*" >&2
    exit 2
  fi
  printf '%s' "$out"
}

fail=0
check() { # $1=ID  $2=설명  $3=grep 결과(위반 라인)
  if [ -n "$3" ]; then
    printf '✗ %s 위반: %s\n' "$1" "$2"
    printf '%s\n' "$3" | sed 's/^/    /'
    fail=1
  else
    printf '✓ %s\n' "$1"
  fi
}

INC=(--include=*.ts --include=*.tsx)

m_any=$(g -rnE ': any\b' src app "${INC[@]}")
check INV-no-any "any 타입 금지" "$m_any"

m_then=$(g -rn '\.then(' src app "${INC[@]}")
check INV-async-await "Promise.then() 금지(async/await만)" "$m_then"

m_av=$(g -rnE "['\"]expo-av" src app "${INC[@]}")
check INV-no-expo-av "expo-av import 금지(expo-video/expo-audio)" "$m_av"

m_class=$(g -rnE '^[[:space:]]*(export )?(abstract )?class ' src "${INC[@]}")
m_class=$(printf '%s' "$m_class" | grep -v 'extends Error' || true)
check INV-no-class "repo/service 클래스 금지(Error 서브클래스 예외)" "$m_class"

m_sync=$(g -rnE 'getFirstSync|getAllSync|execSync|runSync' src --include=*.ts)
check INV-sqlite-async "legacy sync sqlite API 금지" "$m_sync"

m_tx=$(g -rn 'transaction(' src --include=*.ts)
m_tx=$(printf '%s' "$m_tx" | grep -v 'withTransactionAsync' || true)
check INV-sqlite-tx "비-async transaction() 금지(withTransactionAsync만)" "$m_tx"

m_uisql=$(g -rnE 'runAsync|getFirstAsync|getAllAsync|execAsync' app src/stores "${INC[@]}")
check INV-repo-only "UI/store에서 SQL 직접 실행 금지(repo/service 경유)" "$m_uisql"

m_assert=$(g -rnE 'as Decision\b|as Transcript\b|as AiResponse\b' src/services --include=*.ts)
check INV-zod-parse "AI 응답 타입단언 금지(safeParse 사용)" "$m_assert"

m_palette=$(g -rn "from '@/theme/tokens'" app src/components "${INC[@]}")
check INV-token-palette "palette 직접 import 금지(semantic 토큰 경유)" "$m_palette"

m_hex=$(g -rnE '#[0-9a-fA-F]{6}' app src/components "${INC[@]}")
check INV-token-hardcode "색상 하드코딩(#RRGGBB) 금지(@/theme 토큰 사용)" "$m_hex"

echo
if [ "$fail" -ne 0 ]; then
  echo "불변식 위반 발견 — INVARIANTS.md 참조."
  exit 1
fi
echo "모든 불변식 통과."
