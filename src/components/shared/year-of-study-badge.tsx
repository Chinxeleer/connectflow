import { Badge } from "@/components/ui/badge.tsx";
import { YEAR_OF_STUDY_LABELS, type YearOfStudy } from "@/db/schema/members.ts";

/** One reading of a member's year of study, shared wherever a profile shows it. */
export function YearOfStudyBadge({
	yearOfStudy,
}: {
	yearOfStudy: YearOfStudy;
}) {
	return <Badge variant="outline">{YEAR_OF_STUDY_LABELS[yearOfStudy]}</Badge>;
}
