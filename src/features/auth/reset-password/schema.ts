import { z } from "zod";

export const resetPasswordSchema = z
	.object({
		newPassword: z.string().min(8, "Use at least 8 characters."),
		confirmPassword: z.string().min(1, "Confirm your new password."),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords don't match.",
		path: ["confirmPassword"],
	});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
