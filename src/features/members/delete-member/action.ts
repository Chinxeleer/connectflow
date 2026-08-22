import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { count, eq } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { auth } from "@/lib/auth.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { decideDelete } from "./guard.ts";
import { deleteMemberSchema } from "./schema.ts";

/**
 * Hard-deletes a member. Admin-only, and refused outright when anyone reports
 * to them — the UI hiding the button is a convenience, not the access control.
 *
 * The lookup, the report count and the delete run in one transaction so a
 * member cannot acquire a report between the check and the delete. The
 * `restrict` foreign key is the final backstop if that ever happens anyway.
 */
export const deleteMember = createServerFn({ method: "POST" })
	.validator(deleteMemberSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });

		requireAdmin(session?.user);

		return await db.transaction(async (tx) => {
			const [member] = await tx
				.select({ id: members.id, name: members.name })
				.from(members)
				.where(eq(members.id, data.id));

			const [reports] = await tx
				.select({ value: count() })
				.from(members)
				.where(eq(members.leaderId, data.id));

			const decision = decideDelete({
				memberExists: Boolean(member),
				memberName: member?.name ?? "this member",
				reportCount: reports?.value ?? 0,
			});

			if (!decision.allowed) throw new Error(decision.reason);

			await tx.delete(members).where(eq(members.id, data.id));

			return { id: data.id, name: member.name };
		});
	});
