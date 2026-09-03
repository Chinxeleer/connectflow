import { Badge } from "@/components/ui/badge.tsx";
import type { MemberStatus } from "@/db/schema/members.ts";

/**
 * One reading of a member's status, shared by the members table, the hierarchy
 * tree and the profile page.
 *
 * Extracted the moment a third surface needed it: three copies of the variant
 * map would drift, and a status that is amber in one place and grey in another
 * stops carrying meaning.
 */
const STATUS_VARIANT: Record<
	MemberStatus,
	"default" | "secondary" | "outline"
> = {
	new: "default",
	contacted: "secondary",
	assigned: "secondary",
	inducted: "outline",
	inactive: "outline",
};

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
	return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{status}</Badge>;
}
