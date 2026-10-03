import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { AuthShell } from "@/components/layout/auth-shell.tsx";
import { ResetPasswordForm } from "@/features/auth/reset-password/index.ts";
import { sessionQueryOptions } from "@/lib/auth-server.ts";

const searchSchema = z.object({
	/** Set by better-auth's own redirect once the link's token checks out. */
	token: z.string().optional(),
	/** Set instead of `token` when the link is stale, reused, or malformed. */
	error: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
	validateSearch: searchSchema,
	beforeLoad: async ({ context }) => {
		const session = await context.queryClient.fetchQuery(sessionQueryOptions);
		if (session) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const { token, error } = Route.useSearch();

	return (
		<AuthShell>
			<ResetPasswordForm token={token} tokenExpired={Boolean(error)} />
		</AuthShell>
	);
}
