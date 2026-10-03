import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { resetPassword } from "./action.ts";
import { resetPasswordSchema } from "./schema.ts";

/** `tokenExpired` covers the `?error=INVALID_TOKEN` redirect better-auth sends when the link in the email is stale or already used. */
export function ResetPasswordForm({
	token,
	tokenExpired,
}: {
	token: string | undefined;
	tokenExpired: boolean;
}) {
	const navigate = useNavigate();
	const [done, setDone] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: { newPassword: "", confirmPassword: "" },
		validators: { onSubmit: resetPasswordSchema },
		onSubmit: async ({ value }) => {
			if (!token) return;
			setFormError(null);
			try {
				await resetPassword({ newPassword: value.newPassword, token });
				setDone(true);
				setTimeout(() => navigate({ to: "/" }), 2000);
			} catch (error) {
				setFormError(
					error instanceof Error ? error.message : "Something went wrong.",
				);
			}
		},
	});

	if (tokenExpired || !token) {
		return (
			<div className="flex flex-col gap-4 text-center">
				<h1 className="text-2xl font-bold">That link has expired</h1>
				<p className="text-muted-foreground text-sm text-balance">
					Reset links are only valid for an hour and only work once. Request a
					new one.
				</p>
				<Button variant="outline" asChild>
					<Link to="/forgot-password">Request a new link</Link>
				</Button>
			</div>
		);
	}

	if (done) {
		return (
			<div className="flex flex-col gap-4 text-center">
				<h1 className="text-2xl font-bold">Password updated</h1>
				<p className="text-muted-foreground text-sm text-balance">
					Taking you to the login page…
				</p>
			</div>
		);
	}

	return (
		<form
			className="flex flex-col gap-6"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void form.handleSubmit();
			}}
		>
			<FieldGroup>
				<div className="flex flex-col items-center gap-1 text-center">
					<h1 className="text-2xl font-bold">Set a new password</h1>
				</div>

				<form.Field name="newPassword">
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0}>
							<FieldLabel htmlFor={field.name}>New password</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								type="password"
								autoComplete="new-password"
								required
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
							<FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								type="password"
								autoComplete="new-password"
								required
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								aria-invalid={field.state.meta.errors.length > 0}
							/>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>

				{formError ? <FieldError role="alert">{formError}</FieldError> : null}

				<Field>
					<form.Subscribe selector={(state) => state.isSubmitting}>
						{(isSubmitting) => (
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Saving…" : "Save new password"}
							</Button>
						)}
					</form.Subscribe>
					<FieldDescription className="text-center">
						<Link to="/" className="underline-offset-4 hover:underline">
							Back to login
						</Link>
					</FieldDescription>
				</Field>
			</FieldGroup>
		</form>
	);
}
