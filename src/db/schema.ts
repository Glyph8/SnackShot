/**
 * DB 스키마 — 버전별 마이그레이션 SQL 배열.
 *
 * 규칙:
 * - 모든 시각은 INTEGER (Unix ms, UTC) — ADR-013
 * - 모든 id는 TEXT (ULID 26자) — ADR-009
 * - soft delete는 deleted_at INTEGER — ADR-014
 * - CHECK 제약은 도메인 타입과 1:1 일치
 * - "활성" 부분 인덱스 (WHERE deleted_at IS NULL) 적극 사용
 */

export const TARGET_VERSION = 25;

// ─── 반복 SQL 상수 (P1-3): 아래 문자열은 마이그레이션에서 글자 그대로 참조된다.
//     ⚠️ 값 변경 금지 — 이미 적용된 마이그레이션 SQL과 바이트 단위로 일치해야 한다(INV-migration-append).

const FTS_TRANSCRIPTS_INSERT = `CREATE TRIGGER fts_transcripts_insert AFTER INSERT ON transcripts BEGIN
       DELETE FROM transcripts_fts WHERE rowid IN (
         SELECT rowid FROM transcripts_fts WHERE entry_id = NEW.entry_id
       );
       INSERT INTO transcripts_fts(entry_id, text)
       VALUES (
         NEW.entry_id,
         COALESCE(
           (SELECT manual_note FROM entries WHERE id = NEW.entry_id),
           ''
         ) || ' ' || COALESCE(NEW.edited_text, NEW.raw_text)
       );
     END`;

const FTS_TRANSCRIPTS_UPDATE = `CREATE TRIGGER fts_transcripts_update AFTER UPDATE ON transcripts BEGIN
       DELETE FROM transcripts_fts WHERE rowid IN (
         SELECT rowid FROM transcripts_fts WHERE entry_id = NEW.entry_id
       );
       INSERT INTO transcripts_fts(entry_id, text)
       VALUES (
         NEW.entry_id,
         COALESCE(
           (SELECT manual_note FROM entries WHERE id = NEW.entry_id),
           ''
         ) || ' ' || COALESCE(NEW.edited_text, NEW.raw_text)
       );
     END`;

const FTS_TRANSCRIPTS_DELETE = `CREATE TRIGGER fts_transcripts_delete AFTER DELETE ON transcripts BEGIN
       DELETE FROM transcripts_fts WHERE rowid IN (
         SELECT rowid FROM transcripts_fts WHERE entry_id = OLD.entry_id
       );
       INSERT INTO transcripts_fts(entry_id, text)
       VALUES (
         OLD.entry_id,
         COALESCE(
           (SELECT manual_note FROM entries WHERE id = OLD.entry_id),
           ''
         ) || ' ' || COALESCE(
           (SELECT COALESCE(edited_text, raw_text) FROM transcripts
            WHERE entry_id = OLD.entry_id ORDER BY created_at DESC LIMIT 1),
           ''
         )
       );
     END`;

const FTS_ENTRIES_UPDATE_NOTE = `CREATE TRIGGER fts_entries_update_note AFTER UPDATE OF manual_note ON entries BEGIN
       DELETE FROM transcripts_fts WHERE rowid IN (
         SELECT rowid FROM transcripts_fts WHERE entry_id = NEW.id
       );
       INSERT INTO transcripts_fts(entry_id, text)
       VALUES (
         NEW.id,
         COALESCE(NEW.manual_note, '') || ' ' || COALESCE(
           (SELECT COALESCE(edited_text, raw_text) FROM transcripts
            WHERE entry_id = NEW.id ORDER BY created_at DESC LIMIT 1),
           ''
         )
       );
     END`;

// v14 신규. body는 FTS_ENTRIES_UPDATE_NOTE와 동일하고 이벤트만 INSERT.
// ⚠️ 향후 entries 테이블 재생성 시(v3/v7 절차) 이 트리거도 드롭/재생성 목록에 포함할 것.
const FTS_ENTRIES_INSERT_NOTE = `CREATE TRIGGER fts_entries_insert_note AFTER INSERT ON entries
     WHEN NEW.manual_note IS NOT NULL BEGIN
       DELETE FROM transcripts_fts WHERE rowid IN (
         SELECT rowid FROM transcripts_fts WHERE entry_id = NEW.id
       );
       INSERT INTO transcripts_fts(entry_id, text)
       VALUES (
         NEW.id,
         COALESCE(NEW.manual_note, '') || ' ' || COALESCE(
           (SELECT COALESCE(edited_text, raw_text) FROM transcripts
            WHERE entry_id = NEW.id ORDER BY created_at DESC LIMIT 1),
           ''
         )
       );
     END`;

const FTS_ENTRIES_SOFT_DELETE = `CREATE TRIGGER fts_entries_soft_delete AFTER UPDATE OF deleted_at ON entries
     WHEN NEW.deleted_at IS NOT NULL BEGIN
       DELETE FROM transcripts_fts WHERE rowid IN (
         SELECT rowid FROM transcripts_fts WHERE entry_id = NEW.id
       );
     END`;

// ─── v15 신규: 결정 전문검색(decisions_fts) 트리거군 (D1) ─────
// 인덱싱 텍스트 = user 우선 요약/상황/이유 + 커스텀 카테고리. rejected 포함 전부 색인.
// insert는 신규 행이라 단순 INSERT, update는 DELETE 후 재INSERT(FTS_TRANSCRIPTS_UPDATE 선례),
// soft delete는 행 제거.
// ⚠️ 향후 decisions 테이블 재생성 시(v3/v7식 CHECK 변경 등) 이 트리거 3개도 반드시
//    선제 DROP + 후행 재생성 목록에 포함할 것(FTS 트리거 × 테이블 재생성 함정, 함정 목록 #1).
const FTS_DECISIONS_INSERT = `CREATE TRIGGER fts_decisions_insert AFTER INSERT ON decisions BEGIN
       INSERT INTO decisions_fts(decision_id, text)
       VALUES (
         NEW.id,
         COALESCE(NEW.user_summary, NEW.summary)
           || ' ' || COALESCE(NEW.user_situation, NEW.situation, '')
           || ' ' || COALESCE(NEW.user_reasoning, NEW.reasoning, '')
           || ' ' || COALESCE(NEW.custom_category, '')
       );
     END`;

const FTS_DECISIONS_UPDATE = `CREATE TRIGGER fts_decisions_update AFTER UPDATE OF summary, user_summary, situation, user_situation, reasoning, user_reasoning, custom_category ON decisions BEGIN
       DELETE FROM decisions_fts WHERE decision_id = NEW.id;
       INSERT INTO decisions_fts(decision_id, text)
       VALUES (
         NEW.id,
         COALESCE(NEW.user_summary, NEW.summary)
           || ' ' || COALESCE(NEW.user_situation, NEW.situation, '')
           || ' ' || COALESCE(NEW.user_reasoning, NEW.reasoning, '')
           || ' ' || COALESCE(NEW.custom_category, '')
       );
     END`;

const FTS_DECISIONS_SOFT_DELETE = `CREATE TRIGGER fts_decisions_soft_delete AFTER UPDATE OF deleted_at ON decisions
     WHEN NEW.deleted_at IS NOT NULL BEGIN
       DELETE FROM decisions_fts WHERE decision_id = NEW.id;
     END`;

const IDX_ENTRIES_RECORDED_AT = `CREATE INDEX idx_entries_recorded_at
       ON entries (recorded_at)
       WHERE deleted_at IS NULL`;

const IDX_ENTRIES_COMPRESSION_STATUS = `CREATE INDEX idx_entries_compression_status
       ON entries (compression_status)
       WHERE deleted_at IS NULL`;

const IDX_ENTRIES_AI_LABEL_STATUS = `CREATE INDEX idx_entries_ai_label_status
       ON entries (ai_label_status)
       WHERE deleted_at IS NULL`;

export const MIGRATIONS: Record<number, string[]> = {
  1: [
    // ─── entries (ADR-003: 클립 1급 객체) ───
    `CREATE TABLE entries (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      recorded_at INTEGER NOT NULL,
      original_path TEXT NOT NULL,
      compressed_path TEXT,
      thumbnail_path TEXT,
      duration_ms INTEGER NOT NULL,
      mode TEXT NOT NULL
        CHECK (mode IN ('voice', 'silent')),
      manual_note TEXT,
      compression_status TEXT NOT NULL
        CHECK (compression_status IN ('pending','processing','done','failed','skipped')),
      ai_label_status TEXT NOT NULL
        CHECK (ai_label_status IN ('pending','processing','done','failed','skipped')),
      metadata_json TEXT,
      user_decision_hint INTEGER NOT NULL DEFAULT 0
        CHECK (user_decision_hint IN (0, 1)),
      deleted_at INTEGER
    )`,
    IDX_ENTRIES_RECORDED_AT,
    IDX_ENTRIES_COMPRESSION_STATUS,
    IDX_ENTRIES_AI_LABEL_STATUS,

    // ─── transcripts (ADR-010: 별도 테이블, 1:N) ───
    `CREATE TABLE transcripts (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES entries(id),
      raw_text TEXT NOT NULL,
      edited_text TEXT,
      engine TEXT NOT NULL,
      engine_version TEXT,
      language TEXT NOT NULL,
      confidence REAL,
      segments_json TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX idx_transcripts_entry_id
       ON transcripts (entry_id, created_at DESC)`,

    // ─── decisions (ADR-006, 007, 016) ───
    `CREATE TABLE decisions (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES entries(id),
      -- AI 원본 (ADR-016)
      summary TEXT NOT NULL,
      category TEXT NOT NULL
        CHECK (category IN ('investment','relationship','career','daily','other')),
      reasoning TEXT,
      alternatives TEXT,
      expected_outcome TEXT,
      evidence_quote TEXT,
      confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
      -- 사용자 편집본 (ADR-016: 별도 컬럼)
      user_summary TEXT,
      user_category TEXT
        CHECK (user_category IS NULL OR user_category IN
          ('investment','relationship','career','daily','other')),
      user_reasoning TEXT,
      -- 상태/메타
      status TEXT NOT NULL
        CHECK (status IN ('extracted','confirmed','rejected','edited')),
      follow_up_at INTEGER,
      follow_up_set_by TEXT,
      outcome_id TEXT,
      extracted_at INTEGER NOT NULL,
      confirmed_at INTEGER,
      ai_engine TEXT NOT NULL,
      tags_json TEXT,
      deleted_at INTEGER
    )`,
    `CREATE INDEX idx_decisions_entry_id
       ON decisions (entry_id)
       WHERE deleted_at IS NULL`,
    `CREATE INDEX idx_decisions_status
       ON decisions (status)
       WHERE deleted_at IS NULL`,
    `CREATE INDEX idx_decisions_follow_up_at
       ON decisions (follow_up_at)
       WHERE deleted_at IS NULL AND follow_up_at IS NOT NULL`,

    // ─── outcomes ───
    `CREATE TABLE outcomes (
      id TEXT PRIMARY KEY,
      decision_id TEXT NOT NULL REFERENCES decisions(id),
      entry_id TEXT REFERENCES entries(id),
      result TEXT NOT NULL
        CHECK (result IN ('good','bad','mixed','unclear','skipped')),
      reflection TEXT,
      learnings TEXT,
      ai_engine TEXT,
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    )`,
    `CREATE INDEX idx_outcomes_decision_id
       ON outcomes (decision_id)
       WHERE deleted_at IS NULL`,

    // ─── decision_links (ADR-007: Stage 2 연관 분석) ───
    `CREATE TABLE decision_links (
      id TEXT PRIMARY KEY,
      from_decision_id TEXT NOT NULL REFERENCES decisions(id),
      to_decision_id TEXT NOT NULL REFERENCES decisions(id),
      link_type TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX idx_decision_links_from
       ON decision_links (from_decision_id)`,
    `CREATE INDEX idx_decision_links_to
       ON decision_links (to_decision_id)`,

    // ─── ai_jobs (ADR-012: DB 기반 큐) ───
    `CREATE TABLE ai_jobs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL
        CHECK (job_type IN ('compression','stt','label_extraction','outcome_followup')),
      target_id TEXT NOT NULL,
      target_table TEXT NOT NULL,
      status TEXT NOT NULL
        CHECK (status IN ('pending','running','done','failed','cancelled')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      scheduled_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      payload_json TEXT
    )`,
    // 큐 디스패치용 (status='pending' AND scheduled_at <= now)
    `CREATE INDEX idx_ai_jobs_dispatch
       ON ai_jobs (status, scheduled_at)`,
    // 대상별 조회
    `CREATE INDEX idx_ai_jobs_target
       ON ai_jobs (target_table, target_id)`,

    // ─── settings (싱글톤 row, id=1) ───
    `CREATE TABLE settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      day_boundary_hour INTEGER NOT NULL DEFAULT 0
        CHECK (day_boundary_hour >= 0 AND day_boundary_hour < 24),
      updated_at INTEGER NOT NULL
    )`,
    // 기본 row 삽입 (updated_at = 마이그레이션 시점)
    `INSERT INTO settings (id, day_boundary_hour, updated_at)
       VALUES (1, 0, CAST(strftime('%s','now') AS INTEGER) * 1000)`,
  ],

  // ─── v2: 전문 검색 FTS5 ───────────────────────────────────────────────────
  2: [
    // transcripts_fts: entry당 1행, text = manual_note + 최신 transcript 텍스트
    // unicode61: 한국어 음절을 단어 단위로 처리 (형태소 분석보다 단순하지만 RN 환경에 적합)
    `CREATE VIRTUAL TABLE transcripts_fts USING fts5(
      entry_id UNINDEXED,
      text,
      tokenize = 'unicode61'
    )`,

    // 기존 데이터 backfill: deleted_at IS NULL 항목만, 최신 transcript 1개
    `INSERT INTO transcripts_fts(entry_id, text)
     SELECT
       e.id,
       COALESCE(e.manual_note, '') || ' ' || COALESCE(
         (SELECT COALESCE(t.edited_text, t.raw_text)
          FROM transcripts t
          WHERE t.entry_id = e.id
          ORDER BY t.created_at DESC LIMIT 1),
         ''
       )
     FROM entries e
     WHERE e.deleted_at IS NULL`,

    // ── 트리거: transcripts INSERT (새 STT 결과 → FTS 갱신) ──
    FTS_TRANSCRIPTS_INSERT,

    // ── 트리거: transcripts UPDATE (edited_text 수정 → FTS 갱신) ──
    FTS_TRANSCRIPTS_UPDATE,

    // ── 트리거: transcripts DELETE (ADR-010상 실제로는 발생 안 함, 안전망) ──
    FTS_TRANSCRIPTS_DELETE,

    // ── 트리거: entries.manual_note 변경 → FTS 갱신 ──
    FTS_ENTRIES_UPDATE_NOTE,

    // ── 트리거: entry soft delete → FTS 행 제거 (쿼리 필터 중복 방지) ──
    FTS_ENTRIES_SOFT_DELETE,
  ],

  // ─── v3: entries.mode에 'audio' 추가 ─────────────────────────────────────
  // SQLite는 CHECK 제약 변경을 직접 지원하지 않으므로 테이블 재생성.
  //
  // 핵심 주의사항: fts_transcripts_{insert,update,delete} 트리거는
  // transcripts 테이블에 정의되어 있지만 body 안에서 entries를 참조한다.
  // DROP TABLE entries 후 RENAME entries_new → entries 사이 구간에
  // SQLite가 스키마 재검증 시 이 트리거들을 컴파일하려 해 "no such table: entries"
  // 에러가 발생한다. 따라서 entries를 참조하는 모든 트리거를 선제적으로 드롭하고
  // 새 entries 테이블이 준비된 뒤에 전부 재생성한다.
  3: [
    // ── 1. entries를 참조하는 모든 FTS 트리거 제거 ──
    `DROP TRIGGER IF EXISTS fts_entries_update_note`,
    `DROP TRIGGER IF EXISTS fts_entries_soft_delete`,
    `DROP TRIGGER IF EXISTS fts_transcripts_insert`,
    `DROP TRIGGER IF EXISTS fts_transcripts_update`,
    `DROP TRIGGER IF EXISTS fts_transcripts_delete`,

    // ── 2. 새 테이블 생성 (mode CHECK 확장) ──
    `CREATE TABLE entries_new (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      recorded_at INTEGER NOT NULL,
      original_path TEXT NOT NULL,
      compressed_path TEXT,
      thumbnail_path TEXT,
      duration_ms INTEGER NOT NULL,
      mode TEXT NOT NULL
        CHECK (mode IN ('voice', 'silent', 'audio')),
      manual_note TEXT,
      compression_status TEXT NOT NULL
        CHECK (compression_status IN ('pending','processing','done','failed','skipped')),
      ai_label_status TEXT NOT NULL
        CHECK (ai_label_status IN ('pending','processing','done','failed','skipped')),
      metadata_json TEXT,
      user_decision_hint INTEGER NOT NULL DEFAULT 0
        CHECK (user_decision_hint IN (0, 1)),
      deleted_at INTEGER
    )`,

    // ── 3. 기존 데이터 복사 ──
    `INSERT INTO entries_new SELECT * FROM entries`,

    // ── 4. 구 테이블 제거 (트리거가 모두 제거된 상태이므로 안전) ──
    `DROP TABLE entries`,

    // ── 5. 이름 변경 ──
    `ALTER TABLE entries_new RENAME TO entries`,

    // ── 6. 인덱스 재생성 ──
    IDX_ENTRIES_RECORDED_AT,
    IDX_ENTRIES_COMPRESSION_STATUS,
    IDX_ENTRIES_AI_LABEL_STATUS,

    // ── 7. entries 대상 FTS 트리거 재생성 ──
    FTS_ENTRIES_UPDATE_NOTE,
    FTS_ENTRIES_SOFT_DELETE,

    // ── 8. transcripts 대상 FTS 트리거 재생성 (entries 참조 포함) ──
    FTS_TRANSCRIPTS_INSERT,
    FTS_TRANSCRIPTS_UPDATE,
    FTS_TRANSCRIPTS_DELETE,
  ],

  // ─── v4: entries.stt_status 분리 + decisions.outcome_id 제거 ──────────────
  // ai_label_status 과적 해소 — STT 진행/실패 상태를 전용 컬럼으로 분리.
  //
  // 핵심 주의사항: v3와 달리 테이블 재생성을 하지 않는다. ADD/DROP COLUMN은
  // entries를 참조하는 FTS 트리거(fts_transcripts_*, fts_entries_*)의 컴파일에
  // 영향을 주지 않으므로 트리거 드롭/재생성이 불필요하다(FTS 트리거 함정 회피).
  // PRAGMA foreign_keys는 OFF 유지(ADR-024) → DROP COLUMN 시 FK 검증 충돌 없음.
  4: [
    // ── 1. stt_status 컬럼 추가 (NOT NULL → DEFAULT 필수) ──
    `ALTER TABLE entries ADD COLUMN stt_status TEXT NOT NULL DEFAULT 'pending'
       CHECK (stt_status IN ('pending','processing','done','failed','skipped'))`,

    // ── 2. backfill (UPDATE 순서 엄수: done → skipped → failed 복원) ──
    // 2-a. transcript가 있는 entry → STT 완료
    `UPDATE entries SET stt_status = 'done'
       WHERE deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM transcripts t WHERE t.entry_id = entries.id)`,
    // 2-b. silent 모드 → STT 건너뜀 (transcript 없으므로 done과 겹치지 않음)
    `UPDATE entries SET stt_status = 'skipped'
       WHERE mode = 'silent' AND deleted_at IS NULL`,
    // 2-c. 과거 STT 실패 복원: ai_label_status='failed'이면서 아직 미갱신(pending)인 건만.
    //      done/skipped backfill 이후 실행되므로 transcript 있는 비정상 케이스는
    //      이미 stt_status='done'이라 여기 걸리지 않음(done 우선 — 의도된 우선순위).
    //      ai_label_status는 STT 실패가 오해 분류된 것이므로 'pending'으로 복원.
    `UPDATE entries SET stt_status = 'failed', ai_label_status = 'pending'
       WHERE ai_label_status = 'failed' AND stt_status = 'pending'`,

    // ── 3. decisions.outcome_id 제거 (양방향 중복 참조 해소) ──
    // SQLite 3.35+ DROP COLUMN. outcome_id에는 인덱스 없음, decisions를 참조하는
    // 트리거 없음 → 안전. outcomes.decision_id가 단방향 SoT로 유지됨.
    `ALTER TABLE decisions DROP COLUMN outcome_id`,
  ],

  // ─── v5: settings — 옵시디언 연동 컬럼 추가 (ADR-026) ─────────────────────
  // ADD COLUMN 방식: 기존 데이터 보존, 마이그레이션 비용 최소.
  // obsidian_vault_uri: SAF content URI (Android) 또는 file:// URI (iOS/desktop).
  //   NULL = 미연동 상태.
  // obsidian_auto_export: 1 = 연동 시 자동 내보내기, 0 = 수동.
  //   NOT NULL DEFAULT 1 → 싱글톤 기존 row에 즉시 1 적용.
  5: [
    `ALTER TABLE settings ADD COLUMN obsidian_vault_uri TEXT`,
    `ALTER TABLE settings ADD COLUMN obsidian_auto_export INTEGER NOT NULL DEFAULT 1
       CHECK (obsidian_auto_export IN (0, 1))`,
  ],

  // ─── v6: obsidian_export 잡 타입 추가 + entries.exported_at (ADR-026 2단계) ──
  //
  // entries.exported_at: 마지막 성공 export 시각. NULL = 미export / 재export 필요.
  //   ADD COLUMN 방식 — entries는 트리거가 많지만 컬럼 추가는 트리거 재컴파일을 유발하지 않음.
  //
  // ai_jobs.job_type CHECK 변경: SQLite는 CHECK 변경을 지원하지 않으므로 테이블 재생성.
  //   ai_jobs에는 FTS 트리거 없음 → v3(entries 재생성)보다 단순.
  //   인덱스 2개(idx_ai_jobs_dispatch, idx_ai_jobs_target) 재생성 필수.
  6: [
    // ── 1. entries.exported_at 추가 ──
    `ALTER TABLE entries ADD COLUMN exported_at INTEGER`,

    // ── 2. ai_jobs 재생성 (job_type CHECK 확장) ──
    `CREATE TABLE ai_jobs_new (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL
        CHECK (job_type IN ('compression','stt','label_extraction','outcome_followup','obsidian_export')),
      target_id TEXT NOT NULL,
      target_table TEXT NOT NULL,
      status TEXT NOT NULL
        CHECK (status IN ('pending','running','done','failed','cancelled')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      scheduled_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      payload_json TEXT
    )`,
    `INSERT INTO ai_jobs_new SELECT * FROM ai_jobs`,
    `DROP TABLE ai_jobs`,
    `ALTER TABLE ai_jobs_new RENAME TO ai_jobs`,

    // ── 3. 인덱스 재생성 ──
    `CREATE INDEX idx_ai_jobs_dispatch
       ON ai_jobs (status, scheduled_at)`,
    `CREATE INDEX idx_ai_jobs_target
       ON ai_jobs (target_table, target_id)`,
  ],

  // ─── v7: entries.mode에 'text' 추가 ─────────────────────────────────────
  // text mode = 영상/오디오 없이 본문 텍스트만으로 작성하는 메모 entry.
  // original_path NOT NULL 제약은 그대로 두고 text mode entry는 '' 빈 문자열로 저장한다
  // (ADR-003 노트 참조 — 컬럼 nullable화는 v3급 테이블 재생성을 또 요구하므로
  //  본인 사용 도구 원칙상 비용 대비 효용이 낮다).
  //
  // SQLite는 CHECK 제약 변경을 직접 지원하지 않으므로 entries 테이블을 재생성한다.
  // v3와 동일한 "FTS 트리거 함정" 회피 절차를 그대로 적용한다:
  //   fts_transcripts_{insert,update,delete} 트리거 body가 entries를 참조하므로
  //   반드시 선제 드롭 + 후행 재생성.
  7: [
    // ── 1. entries를 참조하는 모든 FTS 트리거 제거 ──
    `DROP TRIGGER IF EXISTS fts_entries_update_note`,
    `DROP TRIGGER IF EXISTS fts_entries_soft_delete`,
    `DROP TRIGGER IF EXISTS fts_transcripts_insert`,
    `DROP TRIGGER IF EXISTS fts_transcripts_update`,
    `DROP TRIGGER IF EXISTS fts_transcripts_delete`,

    // ── 2. 새 테이블 생성 (mode CHECK에 'text' 추가) ──
    // 컬럼 구성은 v6 시점 entries와 동일 (exported_at, stt_status 포함).
    `CREATE TABLE entries_new (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      recorded_at INTEGER NOT NULL,
      original_path TEXT NOT NULL,
      compressed_path TEXT,
      thumbnail_path TEXT,
      duration_ms INTEGER NOT NULL,
      mode TEXT NOT NULL
        CHECK (mode IN ('voice', 'silent', 'audio', 'text')),
      manual_note TEXT,
      compression_status TEXT NOT NULL
        CHECK (compression_status IN ('pending','processing','done','failed','skipped')),
      ai_label_status TEXT NOT NULL
        CHECK (ai_label_status IN ('pending','processing','done','failed','skipped')),
      stt_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (stt_status IN ('pending','processing','done','failed','skipped')),
      metadata_json TEXT,
      user_decision_hint INTEGER NOT NULL DEFAULT 0
        CHECK (user_decision_hint IN (0, 1)),
      exported_at INTEGER,
      deleted_at INTEGER
    )`,

    // ── 3. 기존 데이터 복사 ──
    // SELECT * 금지: v6 entries는 ALTER TABLE ADD COLUMN으로 stt_status(v4),
    // exported_at(v6)이 테이블 끝에 추가되어 있어 entries_new의 컬럼 위치와 달라
    // stt_status NOT NULL 제약 위반이 발생한다. 명시적 컬럼 매핑 필수.
    `INSERT INTO entries_new
       (id, created_at, recorded_at, original_path, compressed_path, thumbnail_path,
        duration_ms, mode, manual_note, compression_status, ai_label_status,
        stt_status, metadata_json, user_decision_hint, exported_at, deleted_at)
     SELECT
       id, created_at, recorded_at, original_path, compressed_path, thumbnail_path,
       duration_ms, mode, manual_note, compression_status, ai_label_status,
       stt_status, metadata_json, user_decision_hint, exported_at, deleted_at
     FROM entries`,

    // ── 4. 구 테이블 제거 (트리거가 모두 제거된 상태이므로 안전) ──
    `DROP TABLE entries`,

    // ── 5. 이름 변경 ──
    `ALTER TABLE entries_new RENAME TO entries`,

    // ── 6. 인덱스 재생성 ──
    IDX_ENTRIES_RECORDED_AT,
    IDX_ENTRIES_COMPRESSION_STATUS,
    IDX_ENTRIES_AI_LABEL_STATUS,

    // ── 7. entries 대상 FTS 트리거 재생성 ──
    FTS_ENTRIES_UPDATE_NOTE,
    FTS_ENTRIES_SOFT_DELETE,

    // ── 8. transcripts 대상 FTS 트리거 재생성 (entries 참조 포함) ──
    FTS_TRANSCRIPTS_INSERT,
    FTS_TRANSCRIPTS_UPDATE,
    FTS_TRANSCRIPTS_DELETE,
  ],

  // ─── v8: 의사결정 = Todo 확장 (전부 additive ADD COLUMN) ────────────────────
  //   - situation/user_situation: 상황(맥락) AI 원본·사용자 편집본 (ADR-016 축 확장)
  //   - executed_at: 수행 완료 시각(null=활성 todo). status와 직교.
  //   - origin: 출처(ai_extracted=자동 발굴 / authored=의도적 작성, 즉시 confirmed)
  //   ⚠️ ALTER ADD COLUMN만 사용 — 기존 테이블 재생성 없음. CHECK는 추가 컬럼 한정.
  8: [
    `ALTER TABLE decisions ADD COLUMN situation TEXT`,
    `ALTER TABLE decisions ADD COLUMN user_situation TEXT`,
    `ALTER TABLE decisions ADD COLUMN executed_at INTEGER`,
    `ALTER TABLE decisions ADD COLUMN origin TEXT NOT NULL DEFAULT 'ai_extracted'
       CHECK (origin IN ('ai_extracted', 'authored'))`,
    // 활성 보드/회고 대기 조회 보조 — 수행 완료(executed_at NOT NULL) 항목만
    `CREATE INDEX idx_decisions_executed_at
       ON decisions (executed_at)
       WHERE deleted_at IS NULL AND executed_at IS NOT NULL`,
  ],

  // ─── v9: 사용자 커스텀 카테고리 (additive) ──────────────────────────────────
  //   - decisions.custom_category: 커스텀 선택 시 라벨 보존(category enum은 'other')
  //   - settings.custom_categories_json: 사용자 정의 카테고리 목록(JSON 배열)
  9: [
    `ALTER TABLE decisions ADD COLUMN custom_category TEXT`,
    `ALTER TABLE settings ADD COLUMN custom_categories_json TEXT`,
  ],

  // ─── v10: 텍스트 버전 로그 (additive, 신규 테이블) ─────────────────────────────
  // 전사(transcript)·결정(decision) 텍스트의 변경 이력을 한 테이블에 누적해 다단계
  // 롤백을 지원한다. 표시 경로는 그대로(transcript.edited_text ?? raw_text,
  // decision.user_* ?? ai) — 이 테이블은 "어떻게 그 값이 됐는지"의 타임라인만 보관한다.
  //   target_kind/source CHECK 값은 src/types/enums.ts와 동일(여기선 import 불가라 인라인).
  //   field: transcript는 'text', decision은 'summary'|'situation'|'reasoning'.
  //   ⚠️ 신규 테이블이라 기존 FTS 트리거와 무관 — v3/v7식 재생성 절차 불필요.
  10: [
    `CREATE TABLE text_revisions (
      id TEXT PRIMARY KEY,
      target_kind TEXT NOT NULL
        CHECK (target_kind IN ('transcript','decision')),
      target_id TEXT NOT NULL,
      field TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL
        CHECK (source IN ('ai_original','manual','ai_rewrite','restore')),
      instruction TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX idx_text_revisions_target
       ON text_revisions (target_kind, target_id, field, created_at DESC)`,
  ],

  // ─── v11: 영상 관리 P0 — 압축 단계 + 원본 백업 추적 (additive ADD COLUMN) ──────
  //   compression_level: 0=원본만, 1/2/3=달성한 압축 단계(다단계 압축, 제안서 참조).
  //     기존 compression_status는 작업 진행상태(pending/.../done)로 그대로 두고 단계는 분리.
  //   original_backed_up_at: 원본을 외부(SAF 월 폴더)로 백업 완료한 시각. null=미백업.
  //   original_purged_at: 백업 후 로컬 원본을 삭제한 시각. null=원본 로컬 보유.
  //   backup_uri: 백업 위치 표시용(선택).
  //   ⚠️ ADD COLUMN은 entries 참조 FTS 트리거 재컴파일을 유발하지 않음(v4/v6 선례) → 트리거 처리 불필요.
  11: [
    `ALTER TABLE entries ADD COLUMN compression_level INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE entries ADD COLUMN original_backed_up_at INTEGER`,
    `ALTER TABLE entries ADD COLUMN original_purged_at INTEGER`,
    `ALTER TABLE entries ADD COLUMN backup_uri TEXT`,
    // 백필: 이미 압축 완료(done)된 기존 엔트리는 1단계로 간주.
    `UPDATE entries SET compression_level = 1 WHERE compression_status = 'done'`,
  ],

  // ─── v12: 영상 관리 P2 — 원본 백업 ─────────────────────────────────────────────
  //   1) ai_jobs.job_type CHECK에 'original_backup' 추가 → CHECK 변경은 테이블 재생성
  //      (v6 obsidian_export 선례 그대로: 새 테이블 → INSERT SELECT → DROP → RENAME → 인덱스 재생성).
  //      ai_jobs에는 FTS 트리거가 없으므로 v3/v7식 트리거 드롭 절차는 불필요.
  //      ⚠️ CHECK 목록은 src/types/enums.ts의 AI_JOB_TYPE과 동일(여기선 import 불가라 인라인).
  //   2) settings: 백업 폴더(SAF) + 백업 후 원본 자동 정리 게이트.
  12: [
    `CREATE TABLE ai_jobs_new (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL
        CHECK (job_type IN ('compression','stt','label_extraction','outcome_followup','obsidian_export','original_backup')),
      target_id TEXT NOT NULL,
      target_table TEXT NOT NULL,
      status TEXT NOT NULL
        CHECK (status IN ('pending','running','done','failed','cancelled')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      scheduled_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      payload_json TEXT
    )`,
    `INSERT INTO ai_jobs_new SELECT * FROM ai_jobs`,
    `DROP TABLE ai_jobs`,
    `ALTER TABLE ai_jobs_new RENAME TO ai_jobs`,
    `CREATE INDEX idx_ai_jobs_dispatch
       ON ai_jobs (status, scheduled_at)`,
    `CREATE INDEX idx_ai_jobs_target
       ON ai_jobs (target_table, target_id)`,

    `ALTER TABLE settings ADD COLUMN backup_dir_uri TEXT`,
    `ALTER TABLE settings ADD COLUMN auto_purge_original INTEGER NOT NULL DEFAULT 0
       CHECK (auto_purge_original IN (0, 1))`,
  ],

  // ─── v13: 영상 관리 P3 — 자동 적용(스윕) 설정 (additive) ───────────────────────
  //   auto_manage_enabled: 전체 자동 관리 on/off (기본 off).
  //   N개월 경과 시 단계 상향/백업 임계값(기본 L2=3, L3=6, 백업=12개월).
  //   sweepVideoMaintenance가 이 값으로 대상 엔트리를 찾아 잡을 enqueue한다.
  13: [
    `ALTER TABLE settings ADD COLUMN auto_manage_enabled INTEGER NOT NULL DEFAULT 0
       CHECK (auto_manage_enabled IN (0, 1))`,
    `ALTER TABLE settings ADD COLUMN auto_l2_after_months INTEGER NOT NULL DEFAULT 3`,
    `ALTER TABLE settings ADD COLUMN auto_l3_after_months INTEGER NOT NULL DEFAULT 6`,
    `ALTER TABLE settings ADD COLUMN auto_backup_after_months INTEGER NOT NULL DEFAULT 12`,
  ],

  // ─── v14: 텍스트 entry INSERT 시 FTS 인덱싱 트리거 (additive) ──────────────────
  // 기존 fts_entries_update_note는 UPDATE OF manual_note에만 반응해, manual_note가
  // INSERT 시점에 채워지는 텍스트 entry(mode='text')는 insertTextEntry가 동일 값
  // 더미 UPDATE로 트리거를 강제 발화시키는 우회가 필요했다(entry당 쓰기 2회).
  // AFTER INSERT 트리거를 추가해 스키마가 직접 정합성을 보장한다 — repo 우회 제거.
  // 기존 데이터는 전부 더미 UPDATE 경로로 이미 인덱싱되어 있어 backfill 불필요.
  // WHEN NEW.manual_note IS NOT NULL: 미디어 entry(INSERT 시 note 없음)는 건너뛰고
  // 기존처럼 transcript INSERT / note UPDATE 시점에 인덱싱된다.
  14: [
    FTS_ENTRIES_INSERT_NOTE,
  ],

  // ─── v15: 결정 전문검색 decisions_fts (D1) ─────────────────
  // decisions 요약/상황/이유(user 우선) + 커스텀 카테고리를 FTS5로 색인. 결정당 정확히 1행.
  // rejected 포함 전부 색인하고 상태 필터는 질의 시 JOIN으로 처리한다(FTS 행 수가 작아 단순성 우선).
  // ⚠️ 신규 가상 테이블 + 트리거 — 기존 entries/transcripts FTS와 독립(v3/v7식 재생성 절차 불필요).
  15: [
    `CREATE VIRTUAL TABLE decisions_fts USING fts5(
      decision_id UNINDEXED,
      text,
      tokenize = 'unicode61'
    )`,

    // 기존 데이터 backfill: deleted_at IS NULL 항목 전부(rejected 포함).
    `INSERT INTO decisions_fts(decision_id, text)
     SELECT
       d.id,
       COALESCE(d.user_summary, d.summary)
         || ' ' || COALESCE(d.user_situation, d.situation, '')
         || ' ' || COALESCE(d.user_reasoning, d.reasoning, '')
         || ' ' || COALESCE(d.custom_category, '')
     FROM decisions d
     WHERE d.deleted_at IS NULL`,

    // ── 트리거: 결정 INSERT → FTS 색인 ──
    FTS_DECISIONS_INSERT,

    // ── 트리거: 편집/원본 텍스트 UPDATE → FTS 재색인(DELETE 후 INSERT) ──
    FTS_DECISIONS_UPDATE,

    // ── 트리거: soft delete → FTS 행 제거 ──
    FTS_DECISIONS_SOFT_DELETE,
  ],

  // ─── v16: 후속 확인 로컬 알림 on/off 설정 (additive) ────────────────────────────
  //   notifications_enabled: follow-up 로컬 알림 사용 여부(기본 off — 최초 토글 시 권한 요청).
  //   ⚠️ ADD COLUMN만 — settings는 트리거 없음(단순 additive).
  16: [
    `ALTER TABLE settings ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 0
       CHECK (notifications_enabled IN (0, 1))`,
  ],

  // ─── v17: 옵시디언 수신함 import (E1) ──────────────────────────────────────────
  //   1) ai_jobs.job_type CHECK에 'obsidian_import' 추가 → CHECK 변경은 테이블 재생성
  //      (v6/v12 선례 그대로: 새 테이블 → INSERT SELECT → DROP → RENAME → 인덱스 2개 재생성).
  //      ai_jobs에는 FTS 트리거 없음 → v3/v7식 트리거 드롭 절차 불필요.
  //      ⚠️ CHECK 목록은 src/types/enums.ts의 AI_JOB_TYPE과 동일(여기선 import 불가라 인라인).
  //   2) settings.obsidian_inbox_last_hash: 수신함 파일 마지막 import 해시(중복 방어).
  17: [
    `CREATE TABLE ai_jobs_new (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL
        CHECK (job_type IN ('compression','stt','label_extraction','outcome_followup','obsidian_export','original_backup','obsidian_import')),
      target_id TEXT NOT NULL,
      target_table TEXT NOT NULL,
      status TEXT NOT NULL
        CHECK (status IN ('pending','running','done','failed','cancelled')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      scheduled_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      payload_json TEXT
    )`,
    `INSERT INTO ai_jobs_new SELECT * FROM ai_jobs`,
    `DROP TABLE ai_jobs`,
    `ALTER TABLE ai_jobs_new RENAME TO ai_jobs`,
    `CREATE INDEX idx_ai_jobs_dispatch
       ON ai_jobs (status, scheduled_at)`,
    `CREATE INDEX idx_ai_jobs_target
       ON ai_jobs (target_table, target_id)`,

    `ALTER TABLE settings ADD COLUMN obsidian_inbox_last_hash TEXT`,
  ],

  // ─── v18: entries.mode에 'photo' 추가 ─────────────────────────────────────
  // photo mode = 카메라 사진 캡처. 영상과 동일 파이프라인(다단계 압축·백업·자동관리).
  //   duration_ms=0으로 저장. STT/AI는 silent와 동일하게 skip(메모로 수동 트리거 가능).
  // v7과 동일한 CHECK 확장 절차. 단 v14에서 추가된 fts_entries_insert_note 트리거와
  //   v11에서 추가된 컬럼 4개(compression_level·original_backed_up_at·original_purged_at·backup_uri)를 반드시 포함한다.
  18: [
    // ── 1. entries를 참조하는 모든 FTS 트리거 제거 (insert_note 포함 — v14) ──
    `DROP TRIGGER IF EXISTS fts_entries_insert_note`,
    `DROP TRIGGER IF EXISTS fts_entries_update_note`,
    `DROP TRIGGER IF EXISTS fts_entries_soft_delete`,
    `DROP TRIGGER IF EXISTS fts_transcripts_insert`,
    `DROP TRIGGER IF EXISTS fts_transcripts_update`,
    `DROP TRIGGER IF EXISTS fts_transcripts_delete`,

    // ── 2. 새 테이블 생성 (mode CHECK에 'photo' 추가, v11 컬럼 포함) ──
    `CREATE TABLE entries_new (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      recorded_at INTEGER NOT NULL,
      original_path TEXT NOT NULL,
      compressed_path TEXT,
      thumbnail_path TEXT,
      duration_ms INTEGER NOT NULL,
      mode TEXT NOT NULL
        CHECK (mode IN ('voice', 'silent', 'audio', 'text', 'photo')),
      manual_note TEXT,
      compression_status TEXT NOT NULL
        CHECK (compression_status IN ('pending','processing','done','failed','skipped')),
      ai_label_status TEXT NOT NULL
        CHECK (ai_label_status IN ('pending','processing','done','failed','skipped')),
      stt_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (stt_status IN ('pending','processing','done','failed','skipped')),
      metadata_json TEXT,
      user_decision_hint INTEGER NOT NULL DEFAULT 0
        CHECK (user_decision_hint IN (0, 1)),
      exported_at INTEGER,
      deleted_at INTEGER,
      compression_level INTEGER NOT NULL DEFAULT 0,
      original_backed_up_at INTEGER,
      original_purged_at INTEGER,
      backup_uri TEXT
    )`,

    // ── 3. 기존 데이터 복사 (명시적 컬럼 매핑 — v11 ADD COLUMN으로 컬럼이 끝에 붙어 위치가 다름) ──
    `INSERT INTO entries_new
       (id, created_at, recorded_at, original_path, compressed_path, thumbnail_path,
        duration_ms, mode, manual_note, compression_status, ai_label_status,
        stt_status, metadata_json, user_decision_hint, exported_at, deleted_at,
        compression_level, original_backed_up_at, original_purged_at, backup_uri)
     SELECT
       id, created_at, recorded_at, original_path, compressed_path, thumbnail_path,
       duration_ms, mode, manual_note, compression_status, ai_label_status,
       stt_status, metadata_json, user_decision_hint, exported_at, deleted_at,
       compression_level, original_backed_up_at, original_purged_at, backup_uri
     FROM entries`,

    // ── 4. 구 테이블 제거 ──
    `DROP TABLE entries`,

    // ── 5. 이름 변경 ──
    `ALTER TABLE entries_new RENAME TO entries`,

    // ── 6. 인덱스 재생성 ──
    IDX_ENTRIES_RECORDED_AT,
    IDX_ENTRIES_COMPRESSION_STATUS,
    IDX_ENTRIES_AI_LABEL_STATUS,

    // ── 7. entries 대상 FTS 트리거 재생성 (v14 insert_note 포함) ──
    FTS_ENTRIES_UPDATE_NOTE,
    FTS_ENTRIES_INSERT_NOTE,
    FTS_ENTRIES_SOFT_DELETE,

    // ── 8. transcripts 대상 FTS 트리거 재생성 (entries 참조 포함) ──
    FTS_TRANSCRIPTS_INSERT,
    FTS_TRANSCRIPTS_UPDATE,
    FTS_TRANSCRIPTS_DELETE,
  ],

  // ─── v19: 설정에 프로필 AI 전달 토글 추가 (additive ADD COLUMN) ──────────────
  //   profile_ai_enabled: 1=결정 추출·작성·재작성 시 Profile.md를 AI에 전달(기본), 0=전달 안 함.
  //   ⚠️ ADD COLUMN만 — settings는 트리거 없음(단순 additive).
  19: [
    `ALTER TABLE settings ADD COLUMN profile_ai_enabled INTEGER NOT NULL DEFAULT 1
       CHECK (profile_ai_enabled IN (0, 1))`,
  ],

  // ─── v20: 사용자 입력 확신도 (additive ADD COLUMN, F3) ────────────────────────
  //   user_confidence: 0~1 REAL, 본인이 결정 시점에 스스로 매긴 확신도(EditDecisionSheet·compose 칩).
  //   AI 추출 confidence와 별개 — calibration은 COALESCE(user_confidence, confidence)로 본인 입력 우선.
  //   ⚠️ ADD COLUMN만 — decisions 재생성/CHECK 재생성 불필요(v8 additive 선례).
  20: [
    `ALTER TABLE decisions ADD COLUMN user_confidence REAL`,
  ],

  // ─── v21: 미결(deliberating) 결정 상태 + decide_by 마감 (ADR-028, F5) ──────────
  //   status CHECK에 'deliberating' 추가 = 테이블 재생성(v18 선례). decide_by INTEGER(마감, nullable) 추가.
  //   ⚠️ decisions_fts 트리거 3개(D1)를 선제 DROP·후행 재생성(FTS×재생성 함정 #1).
  //   기존 26컬럼은 명시적 매핑으로 보존(v8/v9/v20 ADD COLUMN으로 위치가 뒤에 붙어 있음).
  21: [
    // ── 1. decisions 참조 FTS 트리거 제거 ──
    `DROP TRIGGER IF EXISTS fts_decisions_insert`,
    `DROP TRIGGER IF EXISTS fts_decisions_update`,
    `DROP TRIGGER IF EXISTS fts_decisions_soft_delete`,

    // ── 2. 새 테이블(status CHECK에 deliberating 추가 + decide_by) ──
    `CREATE TABLE decisions_new (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES entries(id),
      summary TEXT NOT NULL,
      category TEXT NOT NULL
        CHECK (category IN ('investment','relationship','career','daily','other')),
      reasoning TEXT,
      alternatives TEXT,
      expected_outcome TEXT,
      evidence_quote TEXT,
      confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
      user_summary TEXT,
      user_category TEXT
        CHECK (user_category IS NULL OR user_category IN
          ('investment','relationship','career','daily','other')),
      user_reasoning TEXT,
      status TEXT NOT NULL
        CHECK (status IN ('extracted','confirmed','rejected','edited','deliberating')),
      follow_up_at INTEGER,
      follow_up_set_by TEXT,
      extracted_at INTEGER NOT NULL,
      confirmed_at INTEGER,
      ai_engine TEXT NOT NULL,
      tags_json TEXT,
      deleted_at INTEGER,
      situation TEXT,
      user_situation TEXT,
      executed_at INTEGER,
      origin TEXT NOT NULL DEFAULT 'ai_extracted'
        CHECK (origin IN ('ai_extracted', 'authored')),
      custom_category TEXT,
      user_confidence REAL,
      decide_by INTEGER
    )`,

    // ── 3. 기존 데이터 복사 (명시적 26컬럼 매핑, decide_by는 NULL) ──
    `INSERT INTO decisions_new
       (id, entry_id, summary, category, reasoning, alternatives, expected_outcome,
        evidence_quote, confidence, user_summary, user_category, user_reasoning,
        status, follow_up_at, follow_up_set_by, extracted_at, confirmed_at, ai_engine,
        tags_json, deleted_at, situation, user_situation, executed_at, origin,
        custom_category, user_confidence)
     SELECT
        id, entry_id, summary, category, reasoning, alternatives, expected_outcome,
        evidence_quote, confidence, user_summary, user_category, user_reasoning,
        status, follow_up_at, follow_up_set_by, extracted_at, confirmed_at, ai_engine,
        tags_json, deleted_at, situation, user_situation, executed_at, origin,
        custom_category, user_confidence
     FROM decisions`,

    // ── 4. 구 테이블 제거 ──
    `DROP TABLE decisions`,

    // ── 5. 이름 변경 ──
    `ALTER TABLE decisions_new RENAME TO decisions`,

    // ── 6. 인덱스 재생성 (v1 3개 + v8 executed_at) ──
    `CREATE INDEX idx_decisions_entry_id
       ON decisions (entry_id)
       WHERE deleted_at IS NULL`,
    `CREATE INDEX idx_decisions_status
       ON decisions (status)
       WHERE deleted_at IS NULL`,
    `CREATE INDEX idx_decisions_follow_up_at
       ON decisions (follow_up_at)
       WHERE deleted_at IS NULL AND follow_up_at IS NOT NULL`,
    `CREATE INDEX idx_decisions_executed_at
       ON decisions (executed_at)
       WHERE deleted_at IS NULL AND executed_at IS NOT NULL`,

    // ── 7. decisions_fts 트리거 재생성 (D1 상수 재사용) ──
    FTS_DECISIONS_INSERT,
    FTS_DECISIONS_UPDATE,
    FTS_DECISIONS_SOFT_DELETE,
  ],

  // ─── v22: 매매 구조화 필드 (additive ADD COLUMN, H1) ──────────────────────────
  //   structured_json: 매매 결정의 정량 필드(TradeDetails Zod) JSON. investment 작성·캡처에서만 생성.
  //   ⚠️ ADD COLUMN만 — 파싱은 호출자 책임(safeParse), 읽기 실패 시 무시.
  22: [
    `ALTER TABLE decisions ADD COLUMN structured_json TEXT`,
  ],

  // ─── v23: 포트폴리오 스냅샷 (신규 테이블, H3) ─────────────────────────────────
  //   증권앱 캡처 파싱 결과(사용자 확인 후) 저장. 캐시 아님 → soft delete. 원본 이미지는 미보관(프라이버시).
  23: [
    `CREATE TABLE portfolio_snapshots (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('image','manual')),
      holdings_json TEXT NOT NULL,
      deleted_at INTEGER
    )`,
    `CREATE INDEX idx_portfolio_created_at
       ON portfolio_snapshots (created_at)
       WHERE deleted_at IS NULL`,
  ],

  // ─── v24: 시세(일봉 종가) 캐시 + quote_fetch 잡 (H4) ──────────────────────────
  //   1) quotes: (ticker,date) PK 캐시. soft delete 불필요(캐시).
  //   2) ai_jobs.job_type CHECK에 'quote_fetch' 추가 → CHECK 변경은 테이블 재생성(v12/v17 선례).
  //      ai_jobs에는 FTS 트리거 없음 → 트리거 드롭 절차 불필요.
  24: [
    `CREATE TABLE quotes (
      ticker TEXT NOT NULL,
      date TEXT NOT NULL,
      close REAL NOT NULL,
      fetched_at INTEGER NOT NULL,
      PRIMARY KEY (ticker, date)
    )`,
    `CREATE TABLE ai_jobs_new (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL
        CHECK (job_type IN ('compression','stt','label_extraction','outcome_followup','obsidian_export','original_backup','obsidian_import','quote_fetch')),
      target_id TEXT NOT NULL,
      target_table TEXT NOT NULL,
      status TEXT NOT NULL
        CHECK (status IN ('pending','running','done','failed','cancelled')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      scheduled_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      payload_json TEXT
    )`,
    `INSERT INTO ai_jobs_new SELECT * FROM ai_jobs`,
    `DROP TABLE ai_jobs`,
    `ALTER TABLE ai_jobs_new RENAME TO ai_jobs`,
    `CREATE INDEX idx_ai_jobs_dispatch
       ON ai_jobs (status, scheduled_at)`,
    `CREATE INDEX idx_ai_jobs_target
       ON ai_jobs (target_table, target_id)`,
  ],

  // ─── v25: 원칙 상시 대조 캐시 (additive ADD COLUMN, I3) ───────────────
  //   principle_check_json: { checkedAt, principlesHash, conflicts:[{rule,issue}] } JSON.
  //   Profile.md 매매 원칙 × 현재 포트폴리오를 Gemini 1회 대조한 결과를 스냅샷 행에 캐시.
  //   원칙(해시)이 바뀌거나 새 스냅샷(NULL)일 때만 재호출. 파싱은 호출자 책임(읽기 실패 시 무시).
  25: [
    `ALTER TABLE portfolio_snapshots ADD COLUMN principle_check_json TEXT`,
  ],
};
