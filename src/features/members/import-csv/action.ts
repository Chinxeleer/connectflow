import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { type ImportResult, runMemberImport } from "./run-import.ts";
import { importCsvSchema } from "./schema.ts";

/**
 * Imports members from a CSV. Admin-only, enforced here rather than by the
 * button being hidden — a leader calling this directly is rejected.
 */
export const importMembersCsv = createServerFn({ method: "POST" })
	.validator(importCsvSchema)
	.handler(async ({ data }): Promise<ImportResult> => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });

		requireAdmin(session?.user);

		return await runMemberImport(data.csv);
	});

export type { ImportResult };
