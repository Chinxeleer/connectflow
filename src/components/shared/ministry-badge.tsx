import { Badge } from "@/components/ui/badge.tsx";
import { MINISTRY_LABELS, type Ministry } from "@/db/schema/members.ts";

/** One reading of a member's ministry, shared wherever a profile shows it. */
export function MinistryBadge({ ministry }: { ministry: Ministry }) {
	return <Badge variant="outline">{MINISTRY_LABELS[ministry]}</Badge>;
}
