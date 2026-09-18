import { z } from "zod";
import { requiredNameField } from "@/lib/name-field.ts";

/**
 * The Google Form's "remove a member" response. Both name fields are required
 * and non-empty — the whole point of the form is naming who to remove, so a
 * blank name is a malformed submission, not a valid one with something
 * missing.
 */
export const memberRemovalWebhookSchema = z.object({
	firstName: requiredNameField("firstName"),
	surname: requiredNameField("surname"),
	submittedAt: z.iso.datetime({ offset: true }),
});

export type MemberRemovalWebhookInput = z.infer<
	typeof memberRemovalWebhookSchema
>;

export const memberRemovalSchema = memberRemovalWebhookSchema.transform(
	(data) => ({
		firstName: data.firstName,
		surname: data.surname,
		submittedAt: new Date(data.submittedAt),
	}),
);

export type MemberRemovalValues = z.output<typeof memberRemovalSchema>;
