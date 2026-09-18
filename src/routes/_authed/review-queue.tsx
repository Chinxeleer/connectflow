import { createFileRoute, redirect } from "@tanstack/react-router";

/** Moved under Staging — this keeps old links/bookmarks working. */
export const Route = createFileRoute("/_authed/review-queue")({
	beforeLoad: () => {
		throw redirect({ to: "/staging/removal-requests" });
	},
});
