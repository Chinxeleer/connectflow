import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Badge } from "@/components/ui/badge.tsx";
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
import { memberIntakeSchema } from "@/features/intake/member-intake-webhook/index.ts";
import { stagingAttentionQueryOptions } from "@/features/intake/staging-summary/index.ts";
import {
	discardIntakeReconciliation,
	pendingIntakeReconciliationsQueryOptions,
	resolveIntakeReconciliationAsNew,
	resolveIntakeReconciliationAsUpdate,
} from "./action.ts";
import {
	compareIntakeFields,
	type FieldComparison,
	isApplyAllEligible,
	type PersonFields,
} from "./field-comparison.ts";
import { FIELD_LABELS, formatFieldValue } from "./field-labels.ts";
import type {
	IntakeReconciliationCandidateRow,
	PendingIntakeReconciliation,
} from "./query.ts";
import type { IntakeFieldPatch } from "./schema.ts";

function candidateFields(
	candidate: IntakeReconciliationCandidateRow,
): PersonFields {
	return {
		phone: candidate.phone,
		email: candidate.email,
		gender: candidate.gender,
		residence: candidate.residence,
		fieldOfStudy: candidate.fieldOfStudy,
		areaGroup: candidate.areaGroup,
		yearOfStudy: candidate.yearOfStudy,
		ministry: candidate.ministry,
	};
}

function buildPatch(
	comparisons: FieldComparison[],
	useNew: Record<string, boolean>,
): IntakeFieldPatch {
	const patch: Record<string, string> = {};
	for (const comparison of comparisons) {
		if (comparison.incomingValue === null) continue;
		if (comparison.status === "will_add" || useNew[comparison.field]) {
			patch[comparison.field] = comparison.incomingValue;
		}
	}
	return patch as IntakeFieldPatch;
}

function FieldComparisonRow({
	comparison,
	useNew,
	onUseNewChange,
}: {
	comparison: FieldComparison;
	useNew: boolean;
	onUseNewChange: (useNew: boolean) => void;
}) {
	const label = FIELD_LABELS[comparison.field];

	if (comparison.status === "will_add") {
		return (
			<div className="flex items-center justify-between gap-4 py-2 text-sm">
				<span className="font-medium">{label}</span>
				<span className="text-muted-foreground">
					will be added:{" "}
					{formatFieldValue(comparison.field, comparison.incomingValue)}
				</span>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1.5 py-2 text-sm">
			<span className="font-medium">{label}</span>
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					size="sm"
					variant={useNew ? "outline" : "default"}
					onClick={() => onUseNewChange(false)}
				>
					Keep: {formatFieldValue(comparison.field, comparison.existingValue)}
				</Button>
				<Button
					type="button"
					size="sm"
					variant={useNew ? "default" : "outline"}
					onClick={() => onUseNewChange(true)}
				>
					Use new:{" "}
					{formatFieldValue(comparison.field, comparison.incomingValue)}
				</Button>
			</div>
		</div>
	);
}

/**
 * Resolves a NEEDS_REVIEW intake submission: confirm one of the listed
 * candidates (with a field-by-field comparison for what would change),
 * treat the submission as a genuinely new person, or discard it. Every path
 * is available regardless of how many candidates there are — even zero,
 * since "no match" is still a decision an admin has to make.
 */
export function ResolveIntakeReconciliationDialog({
	reconciliation,
}: {
	reconciliation: PendingIntakeReconciliation;
}) {
	const resolveAsUpdate = useServerFn(resolveIntakeReconciliationAsUpdate);
	const resolveAsNew = useServerFn(resolveIntakeReconciliationAsNew);
	const discard = useServerFn(discardIntakeReconciliation);
	const queryClient = useQueryClient();

	const [open, setOpen] = useState(false);
	const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
		reconciliation.candidates.length === 1
			? (reconciliation.candidates[0]?.personId ?? null)
			: null,
	);
	const [useNew, setUseNew] = useState<Record<string, boolean>>({});
	const [confirmingNew, setConfirmingNew] = useState(false);
	const [confirmingDiscard, setConfirmingDiscard] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function reset() {
		setSelectedCandidateId(
			reconciliation.candidates.length === 1
				? (reconciliation.candidates[0]?.personId ?? null)
				: null,
		);
		setUseNew({});
		setConfirmingNew(false);
		setConfirmingDiscard(false);
		setError(null);
	}

	async function afterResolved() {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: pendingIntakeReconciliationsQueryOptions.queryKey,
			}),
			queryClient.invalidateQueries({
				queryKey: stagingAttentionQueryOptions.queryKey,
			}),
		]);
		setOpen(false);
		reset();
	}

	let incoming: ReturnType<typeof memberIntakeSchema.parse> | null = null;
	let parseError: string | null = null;
	try {
		incoming = memberIntakeSchema.parse(reconciliation.rawPayload);
	} catch {
		parseError = "This submission's stored data could not be read.";
	}

	const incomingFields: PersonFields | null = incoming
		? {
				phone: incoming.phone,
				email: incoming.email,
				gender: incoming.gender,
				residence: incoming.residence,
				fieldOfStudy: incoming.fieldOfStudy,
				areaGroup: incoming.areaGroup,
				yearOfStudy: incoming.yearOfStudy,
				ministry: incoming.ministry,
			}
		: null;

	const selectedCandidate = reconciliation.candidates.find(
		(candidate) => candidate.personId === selectedCandidateId,
	);
	const comparisons =
		selectedCandidate && incomingFields
			? compareIntakeFields(candidateFields(selectedCandidate), incomingFields)
			: [];
	const applyAllEligible =
		reconciliation.candidates.length === 1 && isApplyAllEligible(comparisons);

	async function confirmUpdate() {
		if (!selectedCandidateId) {
			setError("Pick which person this submission belongs to.");
			return;
		}
		setPending(true);
		setError(null);
		try {
			await resolveAsUpdate({
				data: {
					reconciliationId: reconciliation.id,
					personId: selectedCandidateId,
					patch: buildPatch(comparisons, useNew),
				},
			});
			await afterResolved();
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Could not resolve that submission.",
			);
		} finally {
			setPending(false);
		}
	}

	async function confirmNew() {
		if (!confirmingNew) {
			setConfirmingNew(true);
			return;
		}
		setPending(true);
		setError(null);
		try {
			await resolveAsNew({ data: { reconciliationId: reconciliation.id } });
			await afterResolved();
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Could not create that person.",
			);
			setConfirmingNew(false);
		} finally {
			setPending(false);
		}
	}

	async function confirmDiscard() {
		if (!confirmingDiscard) {
			setConfirmingDiscard(true);
			return;
		}
		setPending(true);
		setError(null);
		try {
			await discard({ data: { reconciliationId: reconciliation.id } });
			await afterResolved();
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Could not discard that submission.",
			);
			setConfirmingDiscard(false);
		} finally {
			setPending(false);
		}
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
					Review
				</Button>
			</DialogTrigger>

			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{incoming
							? `${incoming.firstName} ${incoming.surname}`
							: "Submission"}
					</DialogTitle>
					<DialogDescription>
						{reconciliation.candidates.length === 0
							? "No matching member was found for this submission."
							: "This submission couldn't be confidently matched on its own — pick who it belongs to, or decide it's someone new."}
					</DialogDescription>
				</DialogHeader>

				{parseError ? (
					<p
						role="alert"
						className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
					>
						{parseError}
					</p>
				) : (
					<>
						{reconciliation.candidates.length > 1 ? (
							<div className="flex flex-col gap-1.5">
								<span className="text-sm font-medium">Who is this?</span>
								<div className="flex flex-wrap gap-1.5">
									{reconciliation.candidates.map((candidate) => (
										<Badge
											key={candidate.personId}
											variant={
												selectedCandidateId === candidate.personId
													? "default"
													: "outline"
											}
											className="cursor-pointer"
											title={candidate.matchReason}
											onClick={() => {
												setSelectedCandidateId(candidate.personId);
												setUseNew({});
											}}
										>
											{candidate.name}
										</Badge>
									))}
								</div>
							</div>
						) : null}

						{selectedCandidate ? (
							<div className="flex flex-col gap-1 rounded-md border p-3">
								<span className="text-sm font-medium">
									Comparing against {selectedCandidate.name}
								</span>
								<span className="text-muted-foreground text-xs">
									{selectedCandidate.matchReason}
								</span>
								{comparisons.length === 0 ? (
									<p className="text-muted-foreground pt-2 text-sm">
										Nothing on this submission differs from their profile.
									</p>
								) : (
									<div className="divide-y">
										{comparisons.map((comparison) => (
											<FieldComparisonRow
												key={comparison.field}
												comparison={comparison}
												useNew={useNew[comparison.field] ?? false}
												onUseNewChange={(next) =>
													setUseNew((current) => ({
														...current,
														[comparison.field]: next,
													}))
												}
											/>
										))}
									</div>
								)}
								{applyAllEligible ? (
									<p className="text-muted-foreground pt-2 text-xs">
										Every change here fills in a blank — nothing to choose.
									</p>
								) : null}
							</div>
						) : null}
					</>
				)}

				{error ? (
					<p
						role="alert"
						className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
					>
						{error}
					</p>
				) : null}

				<DialogFooter className="flex-wrap gap-2 sm:justify-between">
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant={confirmingDiscard ? "destructive" : "ghost"}
							size="sm"
							disabled={pending}
							onClick={() => void confirmDiscard()}
						>
							{confirmingDiscard ? "Confirm discard" : "Discard"}
						</Button>
						<Button
							type="button"
							variant={confirmingNew ? "default" : "outline"}
							size="sm"
							disabled={pending}
							onClick={() => void confirmNew()}
						>
							{confirmingNew
								? "Confirm — create new person"
								: "Treat as new person"}
						</Button>
					</div>

					{reconciliation.candidates.length > 0 ? (
						<Button
							type="button"
							size="sm"
							disabled={pending || !selectedCandidateId || Boolean(parseError)}
							onClick={() => void confirmUpdate()}
						>
							{pending
								? "Saving…"
								: applyAllEligible
									? "Apply all"
									: "Update this person"}
						</Button>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
