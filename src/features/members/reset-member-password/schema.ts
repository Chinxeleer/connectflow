import { z } from "zod";

export const resetMemberPasswordSchema = z.object({
	memberId: z.uuid("Expected a member id."),
});

export type ResetMemberPasswordInput = z.infer<
	typeof resetMemberPasswordSchema
>;
