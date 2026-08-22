/**
 * The delete rule, as a pure decision so it can be tested without a database
 * or a session.
 *
 * A member who leads people is never removed: cascading would delete their
 * whole group, and nulling the link would silently scatter it. Both are worse
 * than refusing, so the caller is told to reassign first.
 */
export type DeleteDecision =
	| { allowed: true }
	| { allowed: false; reason: string };

export function decideDelete({
	memberExists,
	memberName,
	reportCount,
}: {
	memberExists: boolean;
	memberName: string;
	reportCount: number;
}): DeleteDecision {
	if (!memberExists) {
		return { allowed: false, reason: "That member no longer exists." };
	}

	if (reportCount > 0) {
		const people = reportCount === 1 ? "person reports" : "people report";
		return {
			allowed: false,
			reason: `${reportCount} ${people} to ${memberName} — reassign them first.`,
		};
	}

	return { allowed: true };
}
