import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { LeaderPicker } from "@/components/shared/leader-picker.tsx";
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
import { type MemberStatus, memberStatus } from "@/db/schema/members.ts";
import {
	assignablePeopleQueryOptions,
	membersQueryOptions,
} from "@/features/members/member-list/action.ts";
import { memberStatsQueryOptions } from "@/features/members/member-stats/action.ts";
import { createMember } from "./action.ts";
import { createMemberInputSchema } from "./schema.ts";

/** A plain text field; every one of these is optional and backfilled later. */
function TextField({
	field,
	label,
	description,
	...inputProps
}: {
	// biome-ignore lint/suspicious/noExplicitAny: TanStack Form field api
	field: any;
	label: string;
	description?: string;
} & React.ComponentProps<"input">) {
	const invalid = field.state.meta.errors.length > 0;

	return (
		<Field data-invalid={invalid}>
			<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
			<Input
				id={field.name}
				name={field.name}
				autoComplete="off"
				value={field.state.value ?? ""}
				onBlur={field.handleBlur}
				onChange={(event) => field.handleChange(event.target.value)}
				aria-invalid={invalid}
				{...inputProps}
			/>
			{description ? <FieldDescription>{description}</FieldDescription> : null}
			<FieldError errors={field.state.meta.errors} />
		</Field>
	);
}

export function CreateMemberDialog({
	canChooseLeader,
}: {
	canChooseLeader: boolean;
}) {
	const createMemberFn = useServerFn(createMember);
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			name: "",
			leaderId: null as string | null,
			phone: "",
			email: "",
			gender: "",
			residence: "",
			fieldOfStudy: "",
			status: "new" as MemberStatus,
		},
		validators: { onSubmit: createMemberInputSchema },
		onSubmit: async ({ value, formApi }) => {
			setFormError(null);
			try {
				await createMemberFn({ data: value });
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: membersQueryOptions.queryKey,
					}),
					queryClient.invalidateQueries({
						queryKey: assignablePeopleQueryOptions.queryKey,
					}),
					queryClient.invalidateQueries({
						queryKey: memberStatsQueryOptions.queryKey,
					}),
				]);
				formApi.reset();
				setOpen(false);
			} catch (error) {
				setFormError(
					error instanceof Error ? error.message : "Could not add that member.",
				);
			}
		},
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) {
					form.reset();
					setFormError(null);
				}
			}}
		>
			<DialogTrigger asChild>
				<Button size="sm">
					<UserPlus className="size-4" />
					Add Member
				</Button>
			</DialogTrigger>

			<DialogContent className="sm:max-w-lg">
				<form
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						void form.handleSubmit();
					}}
				>
					<DialogHeader>
						<DialogTitle>Add a member</DialogTitle>
						<DialogDescription>
							{canChooseLeader
								? "Only the name is required — the rest can be filled in later."
								: "They will be added to your connect. Only the name is required."}
						</DialogDescription>
					</DialogHeader>

					<FieldGroup className="max-h-[55vh] overflow-y-auto py-4">
						<form.Field name="name">
							{(field) => (
								<TextField
									field={field}
									label="Full name"
									placeholder="Ada Lovelace"
								/>
							)}
						</form.Field>

						{canChooseLeader ? (
							<form.Field name="leaderId">
								{(field) => (
									<Field data-invalid={field.state.meta.errors.length > 0}>
										<FieldLabel htmlFor="leaderId">Connect leader</FieldLabel>
										<LeaderPicker
											id="leaderId"
											value={field.state.value}
											onChange={(next) => field.handleChange(next)}
										/>
										<FieldDescription>
											Leave blank if they have not been assigned yet.
										</FieldDescription>
										<FieldError errors={field.state.meta.errors} />
									</Field>
								)}
							</form.Field>
						) : null}

						<div className="grid gap-4 sm:grid-cols-2">
							<form.Field name="phone">
								{(field) => (
									<TextField
										field={field}
										label="Phone"
										placeholder="0700000000"
									/>
								)}
							</form.Field>
							<form.Field name="email">
								{(field) => (
									<TextField
										field={field}
										label="Email"
										type="email"
										placeholder="ada@example.com"
									/>
								)}
							</form.Field>
							<form.Field name="gender">
								{(field) => <TextField field={field} label="Gender" />}
							</form.Field>
							<form.Field name="residence">
								{(field) => <TextField field={field} label="Residence" />}
							</form.Field>
						</div>

						<form.Field name="fieldOfStudy">
							{(field) => <TextField field={field} label="Field of study" />}
						</form.Field>

						<form.Field name="status">
							{(field) => (
								<Field>
									<FieldLabel htmlFor={field.name}>Status</FieldLabel>
									<Select
										value={field.state.value}
										onValueChange={(value) =>
											field.handleChange(value as MemberStatus)
										}
									>
										<SelectTrigger id={field.name} className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{memberStatus.enumValues.map((status) => (
												<SelectItem key={status} value={status}>
													{status}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
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
									{isSubmitting ? "Adding…" : "Add member"}
								</Button>
							)}
						</form.Subscribe>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
