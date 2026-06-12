/**
 * ADR-021: Zod 스키마로 Gemini 응답을 런타임 검증한다.
 *
 * ZodResponseSchema와 RESPONSE_JSON_SCHEMA는 1:1 대응 관계다.
 * 한쪽을 수정하면 반드시 다른 쪽도 함께 수정하라.
 */

import { z } from 'zod';

const DECISION_CATEGORIES = ['investment', 'relationship', 'career', 'daily', 'other'] as const;

// ─── Zod 런타임 검증 스키마 ────────────────────────────────────────────────────

const DecisionCandidateSchema = z.object({
  summary: z.string(),
  category: z.enum(DECISION_CATEGORIES),
  reasoning: z.string(),
  alternatives: z.string(),
  expectedOutcome: z.string(),
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
          category: { type: 'string', enum: [...DECISION_CATEGORIES] },
          reasoning: { type: 'string' },
          alternatives: { type: 'string' },
          expectedOutcome: { type: 'string' },
          evidence: { type: 'string' },
          confidence: { type: 'number' },
          followUpAfterDays: { type: 'integer', nullable: true },
        },
        required: [
          'summary', 'category', 'reasoning', 'alternatives',
          'expectedOutcome', 'evidence', 'confidence', 'followUpAfterDays',
        ],
      },
    },
  },
  required: ['hasDecision', 'decisions'],
} as const;
