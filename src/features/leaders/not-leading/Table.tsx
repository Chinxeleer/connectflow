import { useSuspenseQuery } from "@tanstack/react-query";
import { MemberRowsTable } from "@/features/members/member-list/Table.tsx";
import { notLeadingMembersQueryOptions } from "./action.ts";

/**
 * Rows arrive already scoped and filtered to "leads nobody" server-side.
 * Reuses the members page's own table so this list looks and behaves exactly
 * like the roster does everywhere else — same columns, same sort/filter/page.
 */
export function NotLeadingTable() {
	const { data } = useSuspenseQuery(notLeadingMembersQueryOptions);

	return (
		<MemberRowsTable
			data={data}
			canDelete={false}
			emptyLabel="Everyone in scope is already leading a connect."
		/>
	);
}
