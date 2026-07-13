/**
 * ADR-021: Zod 스키마로 Gemini 응답을 런타임 검증한다.
 *
 * ZodResponseSchema와 RESPONSE_JSON_SCHEMA는 1:1 대응 관계다.
 * 한쪽을 수정하면 반드시 다른 쪽도 함께 수정하라.
 */

import { z } from 'zod';

import { DECISION_CATEGORY } from '@/types/enums';

// ─── Zod 런타임 검증 스키마 ────────────────────────────────────────────────────

// G4(c): 길이 하드 상한 — 프롬프트 상한(40/80/100/60/80자)에 여유를 둔 게이트.
// 초과 시 safeParse 실패 → 기존 재시도 경로가 동작한다. evidence는 원문 인용이라 상한 금지.
const DecisionCandidateSchema = z.object({
  summary: z.string().max(60),
  category: z.enum(DECISION_CATEGORY),
  situation: z.string().max(120),
  reasoning: z.string().max(150),
  alternatives: z.string().max(100),
  expectedOutcome: z.string().max(120),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
  followUpAfterDays: z.number().int().positive().nullable(),
});

export const GeminiResponseSchema = z.object({
  hasDecision: z.boolean(),
  decisions: z.array(DecisionCandidateSchema),
});

export type GeminiResponse = z.infer<typeof GeminiResponseSchema>;

// ─── Gemini responseSchema (OpenAPI subset) ────────────────────────────────
// ZodResponseSchema와 1:1 대응. 한쪽 수정 시 다른 쪽도 수정.

export const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    hasDecision: { type: 'boolean' },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          category: { type: 'string', enum: [...DECISION_CATEGORY] },
          situation: { type: 'string' },
          reasoning: { type: 'string' },
          alternatives: { type: 'string' },
          expectedOutcome: { type: 'string' },
          evidence: { type: 'string' },
          confidence: { type: 'number' },
          followUpAfterDays: { type: 'integer', nullable: true },
        },
        required: [
          'summary', 'category', 'situation', 'reasoning', 'alternatives',
          'expectedOutcome', 'evidence', 'confidence', 'followUpAfterDays',
        ],
      },
    },
  },
  required: ['hasDecision', 'decisions'],
} as const;

// ─── 의도적 작성: 결정 초안 스키마 (v8 Phase 3) ─────────────────────────────
// ComposeDraftSchema(Zod)와 COMPOSE_JSON_SCHEMA는 1:1 대응. 한쪽 수정 시 다른 쪽도 수정.

// G1(a): situation/alternatives/reasoning/expectedOutcome은 nullable — "모름의 출구".
// 입력에 근거가 없으면 null이 정답이고, 빈 필드는 화면에서 사용자가 직접 채운다(지어내기 방지).
// G1(b): 길이 하드 상한 — 프롬프트 상한(40/80/60/100/80자)에 여유를 둔 게이트.
export const ComposeDraftSchema = z.object({
  summary: z.string().max(60),
  category: z.enum(DECISION_CATEGORY),
  situation: z.string().max(120).nullable(),
  alternatives: z.string().max(100).nullable(),
  reasoning: z.string().max(150).nullable(),
  expectedOutcome: z.string().max(120).nullable(),
  followUpAfterDays: z.number().int().positive().nullable(),
});

export const COMPOSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    category: { type: 'string', enum: [...DECISION_CATEGORY] },
    situation: { type: 'string', nullable: true },
    alternatives: { type: 'string', nullable: true },
    reasoning: { type: 'string', nullable: true },
    expectedOutcome: { type: 'string', nullable: true },
    followUpAfterDays: { type: 'integer', nullable: true },
  },
  required: [
    'summary', 'category', 'situation', 'alternatives',
    'reasoning', 'expectedOutcome', 'followUpAfterDays',
  ],
} as const;

// H3: 포트폴리오 파싱 응답 스키마(trade/portfolio.ts PortfolioParseSchema와 1:1). 전 수치 nullable.
export const PORTFOLIO_JSON_SCHEMA = {
  type: 'object',
  properties: {
    holdings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          ticker: { type: 'string', nullable: true },
          quantity: { type: 'number', nullable: true },
          avgPrice: { type: 'number', nullable: true },
          currentPrice: { type: 'number', nullable: true },
          valuationAmount: { type: 'number', nullable: true },
          purchaseAmount: { type: 'number', nullable: true },
        },
        required: ['name'],
      },
    },
    asOf: { type: 'string', nullable: true },
  },
  required: ['holdings'],
} as const;

// H2: 원칙 대조 응답 — 충돌 배열(없으면 빈 배열).
export const PrincipleCheckSchema = z.object({
  conflicts: z.array(z.object({ rule: z.string(), issue: z.string() })),
});

export const PRINCIPLE_CHECK_JSON_SCHEMA = {
  type: 'object',
  properties: {
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { rule: { type: 'string' }, issue: { type: 'string' } },
        required: ['rule', 'issue'],
      },
    },
  },
  required: ['conflicts'],
} as const;

// ─── 텍스트 재작성: 원본 + 지침 → 교정 텍스트 (v10) ──────────────────────────
// RewriteSchema(Zod)와 REWRITE_JSON_SCHEMA는 1:1 대응. 한쪽 수정 시 다른 쪽도 수정.

export const RewriteSchema = z.object({
  rewritten: z.string(),
});

export const REWRITE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    rewritten: { type: 'string' },
  },
  required: ['rewritten'],
} as const;
