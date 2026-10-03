import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthShell } from "@/components/layout/auth-shell.tsx";
import { ForgotPasswordForm } from "@/features/auth/forgot-password/index.ts";
import { sessionQueryOptions } from "@/lib/auth-server.ts";

export const Route = createFileRoute("/forgot-password")({
	beforeLoad: async ({ context }) => {
		const session = await context.queryClient.fetchQuery(sessionQueryOptions);
		if (session) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	return (
		<AuthShell>
			<ForgotPasswordForm />
		</AuthShell>
	);
}
