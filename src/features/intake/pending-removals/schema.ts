import { z } from "zod";

export const resolvePendingRemovalSchema = z.object({
	pendingRemovalId: z.uuid("Expected a pending removal id."),
	memberId: z.uuid("Pick who this request refers to."),
});

export type ResolvePendingRemovalInput = z.infer<
	typeof resolvePendingRemovalSchema
>;

export const dismissPendingRemovalSchema = z.object({
	pendingRemovalId: z.uuid("Expected a pending removal id."),
});

export type DismissPendingRemovalInput = z.infer<
	typeof dismissPendingRemovalSchema
>;
