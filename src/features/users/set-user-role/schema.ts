import { z } from "zod";
import { userRole } from "@/db/schema/auth.ts";

export const setUserRoleSchema = z.object({
	userId: z.string().min(1),
	role: z.enum(userRole.enumValues),
});

export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;
