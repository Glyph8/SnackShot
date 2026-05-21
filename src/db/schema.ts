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

export const TARGET_VERSION = 1;

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
    `CREATE INDEX idx_entries_recorded_at
       ON entries (recorded_at)
       WHERE deleted_at IS NULL`,
    `CREATE INDEX idx_entries_compression_status
       ON entries (compression_status)
       WHERE deleted_at IS NULL`,
    `CREATE INDEX idx_entries_ai_label_status
       ON entries (ai_label_status)
       WHERE deleted_at IS NULL`,

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
};
