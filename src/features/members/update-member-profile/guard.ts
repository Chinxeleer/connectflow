import { type Actor, isAdmin, isLeader } from "@/lib/permissions.ts";

/**
 * Which fields of one profile the caller may change.
 *
 * The split that matters: *seeing* a member and *editing* them are different
 * questions. The hierarchy page shows a leader their whole downline, so they
 * can open any profile below them (`inDownlineOf` in `scope.ts` decides that).
 * Editing stops at their own row and the people who report directly to them —
 * a grandchild's profile opens read-only.
 */
export type ProfileFieldPermissions = {
	/** name, phone, email, gender, residence, field of study */
	canEditProfile: boolean;
	canEditStatus: boolean;
	canEditLeader: boolean;
};

const NOTHING: ProfileFieldPermissions = {
	canEditProfile: false,
	canEditStatus: false,
	canEditLeader: false,
};

export function memberProfilePermissions({
	actor,
	memberId,
	memberLeaderId,
	linkedMemberIds,
}: {
	actor: Actor;
	memberId: string;
	/** The member's current leader, as stored — not as submitted. */
	memberLeaderId: string | null;
	/** Member rows the actor's account is linked to. */
	linkedMemberIds: ReadonlyArray<string>;
}): ProfileFieldPermissions {
	if (isAdmin(actor)) {
		return { canEditProfile: true, canEditStatus: true, canEditLeader: true };
	}

	// Anything unrecognised is unprivileged. Never compare a raw role here.
	if (!isLeader(actor)) return NOTHING;

	const isSelf = linkedMemberIds.includes(memberId);
	const isDirectReport =
		memberLeaderId !== null && linkedMemberIds.includes(memberLeaderId);

	// A leader with no linked member row leads nobody, so this is false for
	// every member — the same fail-closed answer their member list gives.
	if (!isSelf && !isDirectReport) return NOTHING;

	// Moving someone between connects and moving them through the journey are
	// both decisions about the shape of the ministry, not about one member's
	// details, so they stay with an admin even on a leader's own profile.
	return { canEditProfile: true, canEditStatus: false, canEditLeader: false };
}

export type ProfileUpdateDecision =
	| { allowed: true }
	| { allowed: false; reason: string };

/**
 * Whether this submission may be written.
 *
 * Takes *whether each field changed*, not the values: the form round-trips the
 * current status and leader for every role, so an unchanged value must be
 * accepted while a changed one is refused outright. Silently dropping the
 * change instead would leave the user looking at a saved form and a field that
 * did not move.
 */
export function decideProfileUpdate({
	permissions,
	statusChanged,
	leaderChanged,
}: {
	permissions: ProfileFieldPermissions;
	statusChanged: boolean;
	leaderChanged: boolean;
}): ProfileUpdateDecision {
	if (!permissions.canEditProfile) {
		return {
			allowed: false,
			reason:
				"You can only edit your own profile and the members who report directly to you.",
		};
	}

	// Reported before status: moving someone between connects is the larger
	// claim, and the more useful message when both were attempted.
	if (leaderChanged && !permissions.canEditLeader) {
		return {
			allowed: false,
			reason: "Only an admin can move a member to another connect.",
		};
	}

	if (statusChanged && !permissions.canEditStatus) {
		return {
			allowed: false,
			reason: "Only an admin can change a member's status.",
		};
	}

	return { allowed: true };
}
