import { z } from "zod";

export const brainstormSchema = z.object({
  voting_enabled: z.boolean().default(true),
  max_submissions: z.number().int().min(1).max(50).default(5),
  points_budget: z.number().int().min(1).default(100).optional(),
  time_limit_sec: z.number().int().min(30).default(300),
});

export const assignmentSchema = z.object({
  voting_enabled: z.boolean().default(true),
  max_submissions: z.number().int().min(1).max(50).default(5),
  points_budget: z.number().int().min(1).default(100).optional(),
  time_limit_sec: z.number().int().min(30).default(300),
  prompts: z.array(z.string().min(1)).default([]),
});

export const stocktakeSchema = z.object({
  time_limit_sec: z.number().int().min(30).default(300),
});

export type BrainstormConfig = z.infer<typeof brainstormSchema>;
export type AssignmentConfig = z.infer<typeof assignmentSchema>;
export type StocktakeConfig = z.infer<typeof stocktakeSchema>;

export function validateConfig(type: string, config: any): { ok: boolean; value?: any; error?: string } {
  try {
    if (type === 'brainstorm') {
      const v = brainstormSchema.parse(config);
      return { ok: true, value: v };
    }
    if (type === 'assignment') {
      const v = assignmentSchema.parse(config);
      return { ok: true, value: v };
    }
    if (type === 'stocktake') {
      const v = stocktakeSchema.parse(config);
      return { ok: true, value: v };
    }
    return { ok: false, error: 'Unknown activity type' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Invalid config' };
  }
}

