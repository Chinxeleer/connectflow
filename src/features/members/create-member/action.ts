import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { auth } from "@/lib/auth.ts";
import { requireActor } from "@/lib/permissions.ts";
import { linkedMemberIdsFor } from "../scope.ts";
import { resolveNewMemberLeader } from "./guard.ts";
import { insertMember } from "./query.ts";
import { createMemberSchema } from "./schema.ts";

/**
 * Adds one member by hand.
 *
 * Open to admins and leaders, but not equally: an admin may assign any connect
 * leader, while a leader's new member is forced onto their own connect. The
 * `leaderId` in the payload is a request, never the decision — see `guard.ts`.
 */
export const createMember = createServerFn({ method: "POST" })
	.validator(createMemberSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const actor = requireActor(session?.user);

		const assignment = resolveNewMemberLeader({
			actor,
			requestedLeaderId: data.leaderId,
			linkedMemberIds: await linkedMemberIdsFor(actor.id),
		});

		if (!assignment.allowed) throw new Error(assignment.reason);

		// Check the leader exists so a stale id gives a readable message rather
		// than a raw foreign-key violation.
		if (assignment.leaderId) {
			const [leader] = await db
				.select({ id: members.id })
				.from(members)
				.where(eq(members.id, assignment.leaderId));

			if (!leader) throw new Error("That connect leader no longer exists.");
		}

		const created = await insertMember({
			name: data.name,
			leaderId: assignment.leaderId,
			phone: data.phone,
			email: data.email,
			gender: data.gender,
			residence: data.residence,
			fieldOfStudy: data.fieldOfStudy,
			areaGroup: null,
			status: data.status,
		});

		return { id: created.id, name: created.name };
	});
