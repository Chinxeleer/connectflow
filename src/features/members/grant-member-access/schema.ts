import { z } from "zod";

export const grantMemberAccessSchema = z.object({
	memberId: z.uuid("Expected a member id."),
	email: z.email("Enter a valid email address."),
});

export type GrantMemberAccessInput = z.infer<typeof grantMemberAccessSchema>;
