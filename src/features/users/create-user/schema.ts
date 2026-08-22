import { z } from "zod";
import { userRole } from "@/db/schema/auth.ts";

/**
 * No password field: it is generated on the server and returned once, so it
 * never travels from the browser and is never chosen by a human.
 */
export const createUserSchema = z.object({
	name: z.string().trim().min(2, "Enter the person's full name."),
	email: z.email("Enter a valid email address."),
	role: z.enum(userRole.enumValues),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
