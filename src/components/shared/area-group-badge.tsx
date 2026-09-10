import { Badge } from "@/components/ui/badge.tsx";
import { AREA_GROUP_LABELS, type AreaGroup } from "@/db/schema/members.ts";

/**
 * One reading of a member's area group, shared by the profile page and the
 * areas stats view.
 */
export function AreaGroupBadge({ areaGroup }: { areaGroup: AreaGroup }) {
	return <Badge variant="outline">{AREA_GROUP_LABELS[areaGroup]}</Badge>;
}
