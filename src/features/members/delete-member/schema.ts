import { z } from "zod";

export const deleteMemberSchema = z.object({
	id: z.uuid("Expected a member id."),
});

export type DeleteMemberInput = z.infer<typeof deleteMemberSchema>;
