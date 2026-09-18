import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserCheck } from "lucide-react";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field.tsx";
import { stagingAttentionQueryOptions } from "@/features/intake/staging-summary/index.ts";
import {
	pendingRemovalsQueryOptions,
	resolvePendingRemoval,
} from "./action.ts";
import { MemberPicker } from "./MemberPicker.tsx";
import type { PendingRemovalCandidate } from "./query.ts";

/**
 * Resolving means picking who a removal request actually refers to — the
 * webhook found zero or several members named this, so a human breaks the
 * tie. Confirming soft-deletes the chosen member the same way an exact match
 * would have. `candidates` are suggestions only — clicking one fills the
 * picker, it never resolves on its own, since a fuzzy name match is never
 * grounds to soft-delete someone without a human looking first.
 */
export function ResolvePendingRemovalDialog({
	pendingRemovalId,
	firstName,
	surname,
	candidates,
}: {
	pendingRemovalId: string;
	firstName: string;
	surname: string;
	candidates: PendingRemovalCandidate[];
}) {
	const resolveFn = useServerFn(resolvePendingRemoval);
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [memberId, setMemberId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function confirm() {
		if (!memberId) {
			setError("Pick which member this request refers to.");
			return;
		}

		setPending(true);
		setError(null);
		try {
			await resolveFn({ data: { pendingRemovalId, memberId } });
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: pendingRemovalsQueryOptions.queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: stagingAttentionQueryOptions.queryKey,
				}),
			]);
			setOpen(false);
			setMemberId(null);
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Could not resolve that request.",
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) {
					setError(null);
					setMemberId(null);
				}
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<UserCheck className="size-4" />
					Resolve
				</Button>
			</DialogTrigger>

			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						Who is "{firstName} {surname}"?
					</DialogTitle>
					<DialogDescription>
						Pick the member this removal request refers to. They'll be marked
						inactive and removed from the connect database.
					</DialogDescription>
				</DialogHeader>

				{candidates.length > 0 ? (
					<div className="flex flex-col gap-1.5">
						<span className="text-sm font-medium">Suggested</span>
						<div className="flex flex-wrap gap-1.5">
							{candidates.map((candidate) => (
								<Badge
									key={candidate.id}
									variant={memberId === candidate.id ? "default" : "outline"}
									className="cursor-pointer"
									title={candidate.matchReason}
									onClick={() => setMemberId(candidate.id)}
								>
									{candidate.name}
								</Badge>
							))}
						</div>
					</div>
				) : null}

				<Field data-invalid={Boolean(error)}>
					<FieldLabel>Member</FieldLabel>
					<MemberPicker value={memberId} onChange={setMemberId} />
					{error ? <FieldError>{error}</FieldError> : null}
				</Field>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => setOpen(false)}
						disabled={pending}
					>
						Cancel
					</Button>
					<Button onClick={() => void confirm()} disabled={pending}>
						{pending ? "Resolving…" : "Mark as removed"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
