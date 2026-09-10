import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { auth } from "@/lib/auth.ts";
import { requireActor } from "@/lib/permissions.ts";
import { linkedMemberIdsFor, wouldLoopTheTree } from "../scope.ts";
import { decideProfileUpdate, memberProfilePermissions } from "./guard.ts";
import { updateMemberProfileSchema } from "./schema.ts";

/**
 * Saves one member's profile.
 *
 * Everything the decision rests on is read inside the transaction and the row
 * is locked while it happens, so the "did this field change?" question and the
 * write cannot disagree — two admins editing the same member serialise instead
 * of interleaving.
 *
 * The permission check runs here, not in the form: a leader's request carries a
 * status and a leaderId whether or not their form showed them as editable, and
 * a changed one is refused rather than quietly dropped.
 */
export const updateMemberProfile = createServerFn({ method: "POST" })
	.validator(updateMemberProfileSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const actor = requireActor(session?.user);
		const linkedMemberIds = await linkedMemberIdsFor(actor.id);

		return await db.transaction(async (tx) => {
			const [current] = await tx
				.select({
					id: members.id,
					name: members.name,
					status: members.status,
					leaderId: members.leaderId,
				})
				.from(members)
				.where(eq(members.id, data.memberId))
				.for("update");

			if (!current) throw new Error("That member no longer exists.");

			const leaderChanged = (current.leaderId ?? null) !== data.leaderId;
			const statusChanged = current.status !== data.status;

			const decision = decideProfileUpdate({
				permissions: memberProfilePermissions({
					actor,
					memberId: current.id,
					memberLeaderId: current.leaderId,
					linkedMemberIds,
				}),
				statusChanged,
				leaderChanged,
			});

			if (!decision.allowed) throw new Error(decision.reason);

			if (leaderChanged && data.leaderId !== null) {
				const [newLeader] = await tx
					.select({ id: members.id, name: members.name })
					.from(members)
					.where(eq(members.id, data.leaderId));

				// Nicer than letting the foreign key surface as a raw violation.
				if (!newLeader)
					throw new Error("That connect leader no longer exists.");

				// Reassignment is the only way a human can close a loop in the
				// tree, so it is the place to refuse one. Left unchecked it makes
				// members unreachable from any root and strands them off the page.
				if (await wouldLoopTheTree(current.id, data.leaderId, tx)) {
					throw new Error(
						`${newLeader.name} already sits under ${current.name}, so this would loop the connect tree back on itself.`,
					);
				}
			}

			const [updated] = await tx
				.update(members)
				.set({
					name: data.name,
					phone: data.phone,
					email: data.email,
					gender: data.gender,
					residence: data.residence,
					fieldOfStudy: data.fieldOfStudy,
					areaGroup: data.areaGroup,
					yearOfStudy: data.yearOfStudy,
					status: data.status,
					leaderId: data.leaderId,
				})
				.where(eq(members.id, data.memberId))
				.returning({ id: members.id, name: members.name });

			return {
				id: updated?.id ?? data.memberId,
				name: updated?.name ?? data.name,
			};
		});
	});
