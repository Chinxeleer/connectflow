import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CircleCheck, KeyRound, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { connectLeadersQueryOptions } from "@/features/members/leader-summary/action.ts";
import { leaderStatsQueryOptions } from "../leader-stats/index.ts";
import {
	type BulkGrantAccessResult,
	grantAccessToAllLeaders,
} from "./action.ts";

function ResultStep({
	result,
	onDone,
}: {
	result: BulkGrantAccessResult;
	onDone: () => void;
}) {
	return (
		<>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
					Sent access to {result.granted.length}{" "}
					{result.granted.length === 1 ? "leader" : "leaders"}
				</DialogTitle>
				<DialogDescription>
					Each one got an email with their email and temporary password.
				</DialogDescription>
			</DialogHeader>

			<div className="flex max-h-72 flex-col gap-3 overflow-y-auto text-sm">
				{result.granted.length > 0 ? (
					<div className="rounded-lg border p-3">
						<p className="font-medium">Granted</p>
						<ul className="text-muted-foreground mt-2 list-disc pl-4">
							{result.granted.map((item) => (
								<li key={item.email}>
									{item.name} — {item.email}
								</li>
							))}
						</ul>
					</div>
				) : null}

				{result.failed.length > 0 ? (
					<div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
						<p className="font-medium">{result.failed.length} failed</p>
						<ul className="text-muted-foreground mt-2 list-disc pl-4">
							{result.failed.map((item) => (
								<li key={item.name}>
									{item.name}: {item.error}
								</li>
							))}
						</ul>
					</div>
				) : null}
			</div>

			<DialogFooter>
				<Button type="button" onClick={onDone}>
					Done
				</Button>
			</DialogFooter>
		</>
	);
}

/**
 * Grants access to every leader in scope who has no login yet and does have
 * an email on file, in one go. Nothing to configure — the confirm step is
 * the only thing standing between a click and real emails going out.
 */
export function BulkGrantAccessButton() {
	const grantAllFn = useServerFn(grantAccessToAllLeaders);
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [result, setResult] = useState<BulkGrantAccessResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function run() {
		setPending(true);
		setError(null);
		try {
			const outcome = await grantAllFn();
			setResult(outcome);
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: leaderStatsQueryOptions.queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: connectLeadersQueryOptions.queryKey,
				}),
			]);
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Could not send access to leaders.",
			);
		} finally {
			setPending(false);
		}
	}

	function reset() {
		setResult(null);
		setError(null);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) reset();
			}}
		>
			<DialogTrigger asChild>
				<Button size="sm">
					<KeyRound className="size-4" />
					Send access to all leaders
				</Button>
			</DialogTrigger>

			<DialogContent className="sm:max-w-md">
				{result ? (
					<ResultStep result={result} onDone={() => setOpen(false)} />
				) : (
					<>
						<DialogHeader>
							<DialogTitle>Send access to every leader without it?</DialogTitle>
							<DialogDescription>
								Creates a login for each leader who doesn't have one and has an
								email on file, and emails them their temporary password. This
								can't be undone for the accounts it creates.
							</DialogDescription>
						</DialogHeader>

						{error ? (
							<p
								role="alert"
								className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
							>
								<TriangleAlert className="mt-0.5 size-4 shrink-0" />
								{error}
							</p>
						) : null}

						<DialogFooter>
							<Button type="button" disabled={pending} onClick={run}>
								{pending ? "Sending…" : "Send access"}
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
