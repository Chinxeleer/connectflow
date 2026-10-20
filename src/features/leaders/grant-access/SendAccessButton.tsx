import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, KeyRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { grantMemberAccess } from "@/features/members/grant-member-access/index.ts";
import { connectLeadersQueryOptions } from "@/features/members/leader-summary/action.ts";
import { leaderStatsQueryOptions } from "../leader-stats/index.ts";

/**
 * One leader, one click: no dialog, no email field — it sends to whatever
 * email is already on their member profile. Disappears into a "Linked"
 * label the moment the table refetches and `hasAccount` flips true.
 */
export function SendAccessButton({
	memberId,
	email,
}: {
	memberId: string;
	email: string | null;
}) {
	const grantFn = useServerFn(grantMemberAccess);
	const queryClient = useQueryClient();
	const [pending, setPending] = useState(false);
	const [sent, setSent] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!email) {
		return (
			<span
				className="text-muted-foreground text-xs italic"
				title="Add an email to this member's profile first"
			>
				No email on file
			</span>
		);
	}

	if (sent) {
		return (
			<span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
				<Check className="size-3.5" />
				Sent
			</span>
		);
	}

	return (
		<div className="flex flex-col items-start gap-1">
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={pending}
				onClick={async () => {
					setPending(true);
					setError(null);
					try {
						await grantFn({ data: { memberId, email } });
						setSent(true);
						await Promise.all([
							queryClient.invalidateQueries({
								queryKey: connectLeadersQueryOptions.queryKey,
							}),
							queryClient.invalidateQueries({
								queryKey: leaderStatsQueryOptions.queryKey,
							}),
						]);
					} catch (caught) {
						setError(
							caught instanceof Error
								? caught.message
								: "Could not send access.",
						);
					} finally {
						setPending(false);
					}
				}}
			>
				<KeyRound className="size-3.5" />
				{pending ? "Sending…" : "Send access"}
			</Button>
			{error ? <span className="text-destructive text-xs">{error}</span> : null}
		</div>
	);
}
