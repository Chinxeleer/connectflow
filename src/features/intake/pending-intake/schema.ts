import { z } from "zod";
import { areaGroup, yearOfStudy } from "@/db/schema/members.ts";

/**
 * The fields a resolve-as-update-existing action may change. Every key is
 * optional — the client only includes a field here when it actually needs
 * writing (a `will_add` field, or a `conflict` field the admin chose "use
 * new" for); anything left out is left untouched on the member row.
 */
export const intakeFieldPatchSchema = z
	.object({
		phone: z.string().trim().min(1).max(200),
		email: z.string().trim().min(1).max(200),
		gender: z.string().trim().min(1).max(200),
		residence: z.string().trim().min(1).max(200),
		fieldOfStudy: z.string().trim().min(1).max(200),
		areaGroup: z.enum(areaGroup.enumValues),
		yearOfStudy: z.enum(yearOfStudy.enumValues),
	})
	.partial();

export type IntakeFieldPatch = z.infer<typeof intakeFieldPatchSchema>;

export const resolveAsUpdateExistingSchema = z.object({
	reconciliationId: z.uuid("Expected a reconciliation id."),
	personId: z.uuid("Pick which person this is."),
	patch: intakeFieldPatchSchema,
});

export type ResolveAsUpdateExistingInput = z.infer<
	typeof resolveAsUpdateExistingSchema
>;

export const resolveAsCreateNewSchema = z.object({
	reconciliationId: z.uuid("Expected a reconciliation id."),
});

export type ResolveAsCreateNewInput = z.infer<typeof resolveAsCreateNewSchema>;

export const discardReconciliationSchema = z.object({
	reconciliationId: z.uuid("Expected a reconciliation id."),
});

export type DiscardReconciliationInput = z.infer<
	typeof discardReconciliationSchema
>;
