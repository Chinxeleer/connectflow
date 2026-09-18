import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { LeaderPicker } from "@/components/shared/leader-picker.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { getMemberDetail } from "@/features/members/member-detail/index.ts";
import { membersQueryOptions } from "@/features/members/member-list/index.ts";
import { updateMemberProfile } from "@/features/members/update-member-profile/index.ts";
import { unassignedMembersQueryOptions } from "./action.ts";

/**
 * Assigns a connect leader to one unassigned member. Deliberately not a new
 * server action — this fetches the member's current full profile, then
 * submits it through `updateMemberProfile` with only `leaderId` changed, the
 * same write path the profile edit form already uses. Reassignment logic
 * (loop detection, permission checks) stays in exactly one place.
 */
export function AssignLeaderButton({
	member,
}: {
	member: { id: string; name: string };
}) {
	const getMemberDetailFn = useServerFn(getMemberDetail);
	const updateProfileFn = useServerFn(updateMemberProfile);
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [leaderId, setLeaderId] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function confirm() {
		if (!leaderId) {
			setError("Pick a connect leader first.");
			return;
		}

		setPending(true);
		setError(null);
		try {
			const detail = await getMemberDetailFn({ data: { memberId: member.id } });
			if (detail.status !== "ok") {
				throw new Error("Could not load that member's profile.");
			}

			const current = detail.member;
			await updateProfileFn({
				data: {
					memberId: current.id,
					name: current.name,
					leaderId,
					phone: current.phone ?? "",
					email: current.email ?? "",
					gender: current.gender ?? "",
					residence: current.residence ?? "",
					fieldOfStudy: current.fieldOfStudy ?? "",
					areaGroup: current.areaGroup,
					yearOfStudy: current.yearOfStudy,
					ministry: current.ministry,
					status: current.status,
				},
			});

			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: unassignedMembersQueryOptions.queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: membersQueryOptions.queryKey,
				}),
			]);
			setOpen(false);
			setLeaderId(null);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Could not assign a leader.",
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) {
					setError(null);
					setLeaderId(null);
				}
			}}
		>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm">
					<UserPlus className="size-4" />
					Assign leader
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80" align="end">
				<div className="flex flex-col gap-2">
					<p className="text-sm font-medium">Leader for {member.name}</p>
					<LeaderPicker
						value={leaderId}
						onChange={setLeaderId}
						excludeId={member.id}
					/>
					{error ? <p className="text-destructive text-sm">{error}</p> : null}
					<Button
						size="sm"
						disabled={pending || !leaderId}
						onClick={() => void confirm()}
					>
						{pending ? "Assigning…" : "Confirm"}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
