import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
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
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { memberDetailQueryOptions } from "../member-detail/action.ts";
import { grantMemberAccess } from "./action.ts";
import { grantMemberAccessSchema } from "./schema.ts";

export function GrantMemberAccessDialog({
	memberId,
	memberName,
	memberEmail,
}: {
	memberId: string;
	memberName: string;
	memberEmail: string | null;
}) {
	const grantMemberAccessFn = useServerFn(grantMemberAccess);
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [created, setCreated] = useState<GrantedCredentials | null>(null);
	const [formError, setFormError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: { memberId, email: memberEmail ?? "" },
		validators: { onSubmit: grantMemberAccessSchema },
		onSubmit: async ({ value }) => {
			setFormError(null);
			try {
				const result = await grantMemberAccessFn({ data: value });
				setCreated(result);
				await queryClient.invalidateQueries({
					queryKey: memberDetailQueryOptions(memberId).queryKey,
				});
			} catch (error) {
				setFormError(
					error instanceof Error
						? error.message
						: "Could not grant sign-in access.",
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
				<Button variant="outline" size="sm">
					<KeyRound className="size-4" />
					Grant login access
				</Button>
			</DialogTrigger>

			<DialogContent className="sm:max-w-md">
				{created ? (
					<CredentialsPanel
						created={created}
						title={`${created.name} can now sign in`}
						onDone={() => setOpen(false)}
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
							<DialogTitle>Grant {memberName} login access</DialogTitle>
							<DialogDescription>
								Creates a leader account linked to this member. A temporary
								password is generated automatically and shown once.
							</DialogDescription>
						</DialogHeader>

						<FieldGroup className="py-4">
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

							{formError ? (
								<FieldError role="alert">{formError}</FieldError>
							) : null}
						</FieldGroup>

						<DialogFooter>
							<form.Subscribe selector={(state) => state.isSubmitting}>
								{(isSubmitting) => (
									<Button type="submit" disabled={isSubmitting}>
										{isSubmitting ? "Granting…" : "Grant access"}
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
