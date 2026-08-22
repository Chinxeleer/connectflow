import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { AuthShell } from "@/components/layout/auth-shell.tsx";
import { SignInForm } from "@/features/auth/sign-in/index.ts";
import { sessionQueryOptions } from "@/lib/auth-server.ts";

const searchSchema = z.object({
	/** Where `_authed` sent the visitor away from, restored after sign-in. */
	redirect: z.string().optional(),
});

export const Route = createFileRoute("/")({
	validateSearch: searchSchema,
	beforeLoad: async ({ context, search }) => {
		const session = await context.queryClient.fetchQuery(sessionQueryOptions);

		if (session) {
			throw redirect({ to: search.redirect ?? "/dashboard" });
		}
	},
	component: LoginPage,
});

function LoginPage() {
	const { redirect: redirectTo } = Route.useSearch();

	return (
		<AuthShell>
			<SignInForm redirectTo={redirectTo} />
		</AuthShell>
	);
}
