import { z } from "zod";

export const askInputSchema = z.object({
  text: z.string().trim().min(3).max(4000),
  country: z.enum(["NG", "KE"]).optional(),
  regionCode: z.string().trim().min(2).max(10).optional(),
});

export type AskInput = z.infer<typeof askInputSchema>;
