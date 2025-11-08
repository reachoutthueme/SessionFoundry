import { z } from "zod";

export const GroupCreate = z
  .object({
    session_id: z.string().min(1, "session_id required"),
    name: z
      .string()
      .trim()
      .min(1, "name required")
      .max(80, "name too long")
      .transform((s) => s.replace(/\s+/g, " ")),
  })
  .strict();

export const TemplateApply = z
  .object({
    template_id: z.string().min(1, "template_id required"),
    session_id: z.string().min(1, "session_id required"),
  })
  .strict();

export const ActivityCreate = z
  .object({
    session_id: z.string().min(1),
    type: z.enum(["brainstorm", "stocktake", "assignment"]),
    title: z.string().trim().min(1).max(120),
    instructions: z.string().trim().max(4000).optional().default(""),
    description: z.string().trim().max(4000).optional().default(""),
    config: z.unknown().optional().default({}),
    order_index: z.number().int().min(0).optional(),
  })
  .strict();

export const SubmissionCreate = z
  .object({
    text: z.string().trim().min(1).max(4000),
    activity_id: z.string().min(1).optional(),
    session_id: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.activity_id && !data.session_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "activity_id or session_id required" });
    }
  });

export const VoteCreate = z
  .object({
    submission_id: z.string().min(1),
    value: z.number().int().min(1).max(10),
    activity_id: z.string().min(1).optional(),
    session_id: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.activity_id && !data.session_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "activity_id or session_id required" });
    }
  });

export const VoteBulkCreate = z
  .object({
    items: z
      .array(
        z.object({
          submission_id: z.string().min(1),
          value: z.number().int().min(1).max(10),
        }).strict()
      )
      .min(1),
    activity_id: z.string().min(1).optional(),
    session_id: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.activity_id && !data.session_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "activity_id or session_id required" });
    }
  });

export type GroupCreateInput = z.infer<typeof GroupCreate>;
export type TemplateApplyInput = z.infer<typeof TemplateApply>;
export type ActivityCreateInput = z.infer<typeof ActivityCreate>;
export type SubmissionCreateInput = z.infer<typeof SubmissionCreate>;
export type VoteCreateInput = z.infer<typeof VoteCreate>;
export type VoteBulkCreateInput = z.infer<typeof VoteBulkCreate>;
