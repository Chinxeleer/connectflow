import { type Actor, isAdmin, isLeader } from "@/lib/permissions.ts";

/**
 * Who a newly added member ends up reporting to.
 *
 * The rule that matters: a leader may only add someone to their *own* connect.
 * Whatever `leaderId` arrives in the payload is discarded for a leader and
 * replaced with their own member row, so editing the request cannot attach
 * someone to another leader's group.
 */
export type LeaderAssignment =
	| { allowed: true; leaderId: string | null }
	| { allowed: false; reason: string };

export function resolveNewMemberLeader({
	actor,
	requestedLeaderId,
	linkedMemberIds,
}: {
	actor: Actor;
	/** What the client asked for. Honoured for an admin, ignored for a leader. */
	requestedLeaderId: string | null;
	/** Member rows the actor's account is linked to. */
	linkedMemberIds: ReadonlyArray<string>;
}): LeaderAssignment {
	if (isAdmin(actor)) {
		return { allowed: true, leaderId: requestedLeaderId };
	}

	if (!isLeader(actor)) {
		return { allowed: false, reason: "You do not have permission to do that." };
	}

	// A leader whose account has no member row leads no connect, so there is
	// nowhere to put this person. Same reasoning as their empty member list.
	const [own] = linkedMemberIds;
	if (!own) {
		return {
			allowed: false,
			reason:
				"Your account is not linked to a member record yet, so there is no connect to add anyone to. Ask an admin to link it.",
		};
	}

	// More than one linked row is a data anomaly; the first is used.
	return { allowed: true, leaderId: own };
}
