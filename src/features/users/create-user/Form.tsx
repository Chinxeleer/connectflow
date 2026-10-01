import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import {
	CredentialsPanel,
	type GrantedCredentials,
} from "@/components/shared/credentials-panel.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog.tsx";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select.tsx";
import type { UserRole } from "@/db/schema/auth.ts";
import { usersQueryOptions } from "@/features/users/list-users/index.ts";
import { createUser } from "./action.ts";
import { createUserSchema } from "./schema.ts";

export function CreateUserDialog() {
	const createUserFn = useServerFn(createUser);
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [created, setCreated] = useState<GrantedCredentials | null>(null);
	const [formError, setFormError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: { name: "", email: "", role: "leader" as UserRole },
		validators: { onSubmit: createUserSchema },
		onSubmit: async ({ value, formApi }) => {
			setFormError(null);
			try {
				const result = await createUserFn({ data: value });
				setCreated(result);
				formApi.reset();
				await queryClient.invalidateQueries({
					queryKey: usersQueryOptions.queryKey,
				});
			} catch (error) {
				setFormError(
					error instanceof Error
						? error.message
						: "Could not create that account.",
				);
			}
		},
	});

	function reset() {
		setCreated(null);
		setFormError(null);
		form.reset();
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) reset();
			}}
		>
			<DialogTrigger asChild>
				<Button size="sm">
					<UserPlus className="size-4" />
					Add user
				</Button>
			</DialogTrigger>

			<DialogContent className="sm:max-w-md">
				{created ? (
					<CredentialsPanel
						created={created}
						title={`${created.name} can now sign in`}
						onDone={() => setOpen(false)}
						onAddAnother={reset}
					/>
				) : (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							void form.handleSubmit();
						}}
					>
						<DialogHeader>
							<DialogTitle>Add a user</DialogTitle>
							<DialogDescription>
								A temporary password is generated automatically and shown once.
							</DialogDescription>
						</DialogHeader>

						<FieldGroup className="py-4">
							<form.Field name="name">
								{(field) => (
									<Field data-invalid={field.state.meta.errors.length > 0}>
										<FieldLabel htmlFor={field.name}>Full name</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											autoComplete="off"
											placeholder="Ada Lovelace"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											aria-invalid={field.state.meta.errors.length > 0}
										/>
										<FieldError errors={field.state.meta.errors} />
									</Field>
								)}
							</form.Field>

							<form.Field name="email">
								{(field) => (
									<Field data-invalid={field.state.meta.errors.length > 0}>
										<FieldLabel htmlFor={field.name}>Email</FieldLabel>
										<Input
											id={field.name}
											name={field.name}
											type="email"
											autoComplete="off"
											placeholder="ada@example.com"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											aria-invalid={field.state.meta.errors.length > 0}
										/>
										<FieldError errors={field.state.meta.errors} />
									</Field>
								)}
							</form.Field>

							<form.Field name="role">
								{(field) => (
									<Field data-invalid={field.state.meta.errors.length > 0}>
										<FieldLabel htmlFor={field.name}>Role</FieldLabel>
										<Select
											value={field.state.value}
											onValueChange={(value) =>
												field.handleChange(value as UserRole)
											}
										>
											<SelectTrigger id={field.name} className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="leader">
													Leader — their own members only
												</SelectItem>
												<SelectItem value="admin">
													Admin — full access
												</SelectItem>
											</SelectContent>
										</Select>
										<FieldDescription>
											Leaders see only the members assigned to them.
										</FieldDescription>
										<FieldError errors={field.state.meta.errors} />
									</Field>
								)}
							</form.Field>

							{formError ? (
								<FieldError role="alert">{formError}</FieldError>
							) : null}
						</FieldGroup>

						<DialogFooter>
							<form.Subscribe selector={(state) => state.isSubmitting}>
								{(isSubmitting) => (
									<Button type="submit" disabled={isSubmitting}>
										{isSubmitting ? "Creating…" : "Create user"}
									</Button>
								)}
							</form.Subscribe>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
