export type IntakeFieldKey =
	| "phone"
	| "email"
	| "gender"
	| "residence"
	| "fieldOfStudy"
	| "areaGroup"
	| "yearOfStudy";

export type FieldComparison = {
	field: IntakeFieldKey;
	existingValue: string | null;
	incomingValue: string | null;
	/**
	 * `will_add` — existing is null, incoming fills it in; applied
	 * automatically, never needs a toggle. `conflict` — existing is set and
	 * differs from incoming; the admin picks which one wins. Fields that are
	 * already the same, or where the submission offered nothing, are left out
	 * of the list entirely rather than appearing as a third status — there is
	 * nothing to decide about them.
	 */
	status: "will_add" | "conflict";
};

export type PersonFields = {
	phone: string | null;
	email: string | null;
	gender: string | null;
	residence: string | null;
	fieldOfStudy: string | null;
	areaGroup: string | null;
	yearOfStudy: string | null;
};

const FIELD_KEYS: IntakeFieldKey[] = [
	"phone",
	"email",
	"gender",
	"residence",
	"fieldOfStudy",
	"areaGroup",
	"yearOfStudy",
];

/**
 * Compares an intake submission against one candidate's current profile,
 * field by field, and returns only the fields there's something to decide
 * about. This is the core of the Needs Review resolve dialog: a null
 * existing value never gets a keep/use-new toggle, only a non-null,
 * differing one does.
 */
export function compareIntakeFields(
	existing: PersonFields,
	incoming: PersonFields,
): FieldComparison[] {
	const comparisons: FieldComparison[] = [];

	for (const field of FIELD_KEYS) {
		const existingValue = existing[field];
		const incomingValue = incoming[field];

		if (incomingValue === null) continue;
		if (existingValue === incomingValue) continue;

		comparisons.push({
			field,
			existingValue,
			incomingValue,
			status: existingValue === null ? "will_add" : "conflict",
		});
	}

	return comparisons;
}

/** Whether every comparison can be applied without asking the admin to pick anything. */
export function isApplyAllEligible(comparisons: FieldComparison[]): boolean {
	return (
		comparisons.length > 0 && comparisons.every((c) => c.status === "will_add")
	);
}
