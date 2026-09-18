import {
	AREA_GROUP_LABELS,
	type AreaGroup,
	YEAR_OF_STUDY_LABELS,
	type YearOfStudy,
} from "@/db/schema/members.ts";
import type { IntakeFieldKey } from "./field-comparison.ts";

export const FIELD_LABELS: Record<IntakeFieldKey, string> = {
	phone: "Phone",
	email: "Email",
	gender: "Gender",
	residence: "Residence",
	fieldOfStudy: "Field of study",
	areaGroup: "Area group",
	yearOfStudy: "Year of study",
};

/** Renders an area-group/year-of-study enum value as its display label; everything else is already display text. */
export function formatFieldValue(
	field: IntakeFieldKey,
	value: string | null,
): string {
	if (value === null) return "—";
	if (field === "areaGroup") {
		return AREA_GROUP_LABELS[value as AreaGroup] ?? value;
	}
	if (field === "yearOfStudy") {
		return YEAR_OF_STUDY_LABELS[value as YearOfStudy] ?? value;
	}
	return value;
}
