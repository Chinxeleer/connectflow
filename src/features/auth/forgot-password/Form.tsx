import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
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
import { requestPasswordReset } from "./action.ts";
import { forgotPasswordSchema } from "./schema.ts";

export function ForgotPasswordForm() {
	const [sent, setSent] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: { email: "" },
		validators: { onSubmit: forgotPasswordSchema },
		onSubmit: async ({ value }) => {
			setFormError(null);
			try {
				await requestPasswordReset(value);
				setSent(true);
			} catch (error) {
				setFormError(
					error instanceof Error ? error.message : "Something went wrong.",
				);
			}
		},
	});

	if (sent) {
		return (
			<div className="flex flex-col gap-4 text-center">
				<h1 className="text-2xl font-bold">Check your email</h1>
				<p className="text-muted-foreground text-sm text-balance">
					If an account exists for that email, a reset link is on its way.
				</p>
				<Button variant="outline" asChild>
					<Link to="/">Back to login</Link>
				</Button>
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
					<h1 className="text-2xl font-bold">Reset your password</h1>
					<p className="text-muted-foreground text-sm text-balance">
						Enter your email and we'll send you a reset link
					</p>
				</div>

				<form.Field name="email">
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0}>
							<FieldLabel htmlFor={field.name}>Email</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								type="email"
								autoComplete="email"
								placeholder="m@example.com"
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
								{isSubmitting ? "Sending…" : "Send reset link"}
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
