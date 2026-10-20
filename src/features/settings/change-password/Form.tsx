import { useForm } from "@tanstack/react-form";
import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card.tsx";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { changePassword } from "./action.ts";
import { changePasswordSchema } from "./schema.ts";

export function ChangePasswordForm() {
	const [done, setDone] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
		validators: { onSubmit: changePasswordSchema },
		onSubmit: async ({ value, formApi }) => {
			setFormError(null);
			setDone(false);
			try {
				await changePassword(value);
				formApi.reset();
				setDone(true);
			} catch (error) {
				setFormError(
					error instanceof Error ? error.message : "Something went wrong.",
				);
			}
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Password</CardTitle>
				<CardDescription>
					Changing it signs you out everywhere else.
				</CardDescription>
			</CardHeader>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					setDone(false);
					void form.handleSubmit();
				}}
			>
				<CardContent>
					<FieldGroup>
						<form.Field name="currentPassword">
							{(field) => (
								<Field data-invalid={field.state.meta.errors.length > 0}>
									<FieldLabel htmlFor={field.name}>Current password</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="password"
										autoComplete="current-password"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										aria-invalid={field.state.meta.errors.length > 0}
									/>
									<FieldError errors={field.state.meta.errors} />
								</Field>
							)}
						</form.Field>

						<form.Field name="newPassword">
							{(field) => (
								<Field data-invalid={field.state.meta.errors.length > 0}>
									<FieldLabel htmlFor={field.name}>New password</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="password"
										autoComplete="new-password"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										aria-invalid={field.state.meta.errors.length > 0}
									/>
									<FieldError errors={field.state.meta.errors} />
								</Field>
							)}
						</form.Field>

						<form.Field name="confirmPassword">
							{(field) => (
								<Field data-invalid={field.state.meta.errors.length > 0}>
									<FieldLabel htmlFor={field.name}>
										Confirm new password
									</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="password"
										autoComplete="new-password"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										aria-invalid={field.state.meta.errors.length > 0}
									/>
									<FieldError errors={field.state.meta.errors} />
								</Field>
							)}
						</form.Field>

						{formError ? (
							<FieldError role="alert">{formError}</FieldError>
						) : null}

						{done ? (
							<p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
								<CircleCheck className="size-4" />
								Password changed.
							</p>
						) : null}
					</FieldGroup>
				</CardContent>
				<CardFooter>
					<form.Subscribe selector={(state) => state.isSubmitting}>
						{(isSubmitting) => (
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Saving…" : "Change password"}
							</Button>
						)}
					</form.Subscribe>
				</CardFooter>
			</form>
		</Card>
	);
}
