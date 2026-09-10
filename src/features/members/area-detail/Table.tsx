import { useSuspenseQuery } from "@tanstack/react-query";
import type { AreaGroup } from "@/db/schema/members.ts";
import { MemberRowsTable } from "../member-list/Table.tsx";
import { areaMembersQueryOptions } from "./action.ts";

/**
 * The roster for one area group. Deleting a member from this list would be a
 * stranger surface for it than the members page, so it stays view-only here.
 */
export function AreaMembersTable({ group }: { group: AreaGroup }) {
	const { data } = useSuspenseQuery(areaMembersQueryOptions(group));

	return (
		<MemberRowsTable
			data={data}
			canDelete={false}
			emptyLabel="Nobody has been assigned to this area yet."
		/>
	);
}
