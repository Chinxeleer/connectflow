import { z } from "zod";

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, "Enter your current password."),
		newPassword: z.string().min(8, "Use at least 8 characters."),
		confirmPassword: z.string().min(1, "Confirm your new password."),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords don't match.",
		path: ["confirmPassword"],
	});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
