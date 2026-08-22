import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
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
import { sessionQueryOptions } from "@/lib/auth-server.ts";
import { signIn } from "./action.ts";
import { signInSchema } from "./schema.ts";

export function SignInForm({ redirectTo }: { redirectTo?: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [formError, setFormError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: { email: "", password: "" },
		validators: { onSubmit: signInSchema },
		onSubmit: async ({ value }) => {
			setFormError(null);
			try {
				await signIn(value);
			} catch (error) {
				setFormError(
					error instanceof Error ? error.message : "Something went wrong.",
				);
				return;
			}

			// Drop the cached session so the root `beforeLoad` refetches it on the
			// next navigation. Deliberately no `router.invalidate()` here: it would
			// re-run this route's own `beforeLoad`, which throws a redirect once a
			// session exists, and that interrupt leaves its promise unresolved.
			await queryClient.invalidateQueries({
				queryKey: sessionQueryOptions.queryKey,
			});
			await navigate({ to: redirectTo ?? "/dashboard", replace: true });
		},
	});

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
					<h1 className="text-2xl font-bold">Login to your account</h1>
					<p className="text-muted-foreground text-sm text-balance">
						Enter your email below to login to your account
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

				<form.Field name="password">
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0}>
							<div className="flex items-center">
								<FieldLabel htmlFor={field.name}>Password</FieldLabel>
								<Link
									to="/"
									className="ml-auto text-sm underline-offset-4 hover:underline"
								>
									Forgot your password?
								</Link>
							</div>
							<Input
								id={field.name}
								name={field.name}
								type="password"
								autoComplete="current-password"
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
								{isSubmitting ? "Signing in…" : "Login"}
							</Button>
						)}
					</form.Subscribe>
					<FieldDescription className="text-center">
						Accounts are created by an administrator.
					</FieldDescription>
				</Field>
			</FieldGroup>
		</form>
	);
}
