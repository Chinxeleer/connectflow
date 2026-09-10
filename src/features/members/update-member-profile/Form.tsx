import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { LeaderPicker } from "@/components/shared/leader-picker.tsx";
import { MemberStatusBadge } from "@/components/shared/status-badge.tsx";
import { Button } from "@/components/ui/button.tsx";
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
import {
	AREA_GROUP_LABELS,
	type AreaGroup,
	areaGroup,
	type MemberStatus,
	memberStatus,
	YEAR_OF_STUDY_LABELS,
	type YearOfStudy,
	yearOfStudy,
} from "@/db/schema/members.ts";
import type { MemberDetail } from "../member-detail/query.ts";
import { updateMemberProfile } from "./action.ts";
import type { ProfileFieldPermissions } from "./guard.ts";
import { updateMemberProfileInputSchema } from "./schema.ts";

/** Radix `Select.Item` cannot hold an empty-string value, so "not set" needs one. */
const UNSET_AREA_GROUP = "__unset__";
const UNSET_YEAR_OF_STUDY = "__unset__";

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

/**
 * A field this user may not change, shown as its value rather than a disabled
 * input. A greyed-out control reads as "broken"; plain text reads as "not
 * yours to change", which is what it is.
 */
function ReadOnlyField({
	label,
	children,
	note,
}: {
	label: string;
	children: React.ReactNode;
	note: string;
}) {
	return (
		<Field>
			<FieldLabel>{label}</FieldLabel>
			<div className="flex min-h-9 items-center text-sm">{children}</div>
			<FieldDescription>{note}</FieldDescription>
		</Field>
	);
}

/**
 * The profile editor.
 *
 * Every field is submitted whatever the caller's role, including the status and
 * connect leader they may not touch — the server compares them with the stored
 * row and refuses a change it did not permit. Omitting them for a leader would
 * make an edited request indistinguishable from an honest one.
 */
export function UpdateMemberProfileForm({
	member,
	permissions,
	onSaved,
	onCancel,
}: {
	member: MemberDetail;
	permissions: ProfileFieldPermissions;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const updateProfile = useServerFn(updateMemberProfile);
	const queryClient = useQueryClient();
	const [formError, setFormError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			memberId: member.id,
			name: member.name,
			leaderId: member.leaderId,
			phone: member.phone ?? "",
			email: member.email ?? "",
			gender: member.gender ?? "",
			residence: member.residence ?? "",
			fieldOfStudy: member.fieldOfStudy ?? "",
			areaGroup: member.areaGroup,
			yearOfStudy: member.yearOfStudy,
			status: member.status,
		},
		validators: { onSubmit: updateMemberProfileInputSchema },
		onSubmit: async ({ value }) => {
			setFormError(null);
			try {
				await updateProfile({ data: value });
				// One prefix: a rename or a reassignment moves the list, the
				// stats, the dashboard cards, the tree and this profile.
				await queryClient.invalidateQueries({ queryKey: ["members"] });
				onSaved();
			} catch (error) {
				setFormError(
					error instanceof Error
						? error.message
						: "Could not save that profile.",
				);
			}
		},
	});

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void form.handleSubmit();
			}}
		>
			<FieldGroup>
				<form.Field name="name">
					{(field) => <TextField field={field} label="Full name" />}
				</form.Field>

				<div className="grid gap-4 sm:grid-cols-2">
					<form.Field name="phone">
						{(field) => <TextField field={field} label="Phone" />}
					</form.Field>
					<form.Field name="email">
						{(field) => <TextField field={field} label="Email" />}
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

				<form.Field name="areaGroup">
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0}>
							<FieldLabel htmlFor={field.name}>Area group</FieldLabel>
							<Select
								value={field.state.value ?? UNSET_AREA_GROUP}
								onValueChange={(value) =>
									field.handleChange(
										value === UNSET_AREA_GROUP ? null : (value as AreaGroup),
									)
								}
							>
								<SelectTrigger id={field.name} className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={UNSET_AREA_GROUP}>
										<span className="text-muted-foreground">Not set</span>
									</SelectItem>
									{areaGroup.enumValues.map((group) => (
										<SelectItem key={group} value={group}>
											{AREA_GROUP_LABELS[group]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>

				<form.Field name="yearOfStudy">
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0}>
							<FieldLabel htmlFor={field.name}>Year of study</FieldLabel>
							<Select
								value={field.state.value ?? UNSET_YEAR_OF_STUDY}
								onValueChange={(value) =>
									field.handleChange(
										value === UNSET_YEAR_OF_STUDY
											? null
											: (value as YearOfStudy),
									)
								}
							>
								<SelectTrigger id={field.name} className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={UNSET_YEAR_OF_STUDY}>
										<span className="text-muted-foreground">Not set</span>
									</SelectItem>
									{yearOfStudy.enumValues.map((year) => (
										<SelectItem key={year} value={year}>
											{YEAR_OF_STUDY_LABELS[year]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>

				{permissions.canEditStatus ? (
					<form.Field name="status">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
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
				) : (
					<ReadOnlyField
						label="Status"
						note="Only an admin can change a member's status."
					>
						<MemberStatusBadge status={member.status} />
					</ReadOnlyField>
				)}

				{permissions.canEditLeader ? (
					<form.Field name="leaderId">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel htmlFor={field.name}>Connect leader</FieldLabel>
								<LeaderPicker
									id={field.name}
									value={field.state.value}
									onChange={(leaderId) => field.handleChange(leaderId)}
									excludeId={member.id}
								/>
								<FieldDescription>
									Moving someone here moves them to that leader's connect.
								</FieldDescription>
								<FieldError errors={field.state.meta.errors} />
							</Field>
						)}
					</form.Field>
				) : (
					<ReadOnlyField
						label="Connect leader"
						note="Only an admin can move a member to another connect."
					>
						{member.leaderName ?? (
							<span className="text-muted-foreground italic">Unassigned</span>
						)}
					</ReadOnlyField>
				)}

				{formError ? <FieldError role="alert">{formError}</FieldError> : null}

				<div className="flex justify-end gap-2">
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<form.Subscribe selector={(state) => state.isSubmitting}>
						{(isSubmitting) => (
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Saving…" : "Save changes"}
							</Button>
						)}
					</form.Subscribe>
				</div>
			</FieldGroup>
		</form>
	);
}
