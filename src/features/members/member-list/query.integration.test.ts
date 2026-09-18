import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { selectAssignablePeople, selectMembers } from "./query.ts";

/**
 * Proves the `isOrganization` split against a real database: the roster
 * (`selectMembers`) excludes an entity like "ENC", but the assignable-people
 * list (`LeaderPicker`/`MemberPicker`'s source) still includes it, since it's
 * a valid leader target even though it isn't a real member.
 */
const TAG = `__memberlisttest_${Date.now()}`;
const named = (label: string) => `${TAG} ${label}`;

let orgId = "";
let personId = "";
let createdIds: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)(
	"selectMembers / selectAssignablePeople isOrganization split (database)",
	{ retry: 2 },
	() => {
		beforeAll(async () => {
			const [org, person] = await db
				.insert(members)
				.values([
					{ name: named("Org"), isOrganization: true },
					{ name: named("Person") },
				])
				.returning({ id: members.id });
			orgId = org?.id ?? "";
			personId = person?.id ?? "";
			createdIds = [orgId, personId];
		});

		afterAll(async () => {
			await db.delete(members).where(inArray(members.id, createdIds));
		});

		it("excludes an isOrganization row from the roster", async () => {
			const rows = await selectMembers({ kind: "all" });
			const ids = rows.map((row) => row.id);
			expect(ids).toContain(personId);
			expect(ids).not.toContain(orgId);
		});

		it("includes an isOrganization row among assignable people", async () => {
			const rows = await selectAssignablePeople({ kind: "all" });
			const ids = rows.map((row) => row.id);
			expect(ids).toContain(personId);
			expect(ids).toContain(orgId);
		});
	},
);
