import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import type { UserRole } from "@/db/schema/auth.ts";
import { usersQueryOptions } from "@/features/users/list-users/index.ts";
import { userStatsQueryOptions } from "@/features/users/stats/index.ts";
import { setUserRole } from "./action.ts";

/**
 * Promotes to admin or demotes to leader, with a confirmation step either
 * way — admin is full access to everything in the app, so going either
 * direction is worth a second's pause, not just a stray click.
 */
export function ChangeRoleButton({
	userId,
	name,
	role,
}: {
	userId: string;
	name: string;
	role: UserRole;
}) {
	const setRoleFn = useServerFn(setUserRole);
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const nextRole: UserRole = role === "admin" ? "leader" : "admin";
	const promoting = nextRole === "admin";

	async function confirm() {
		setPending(true);
		setError(null);
		try {
			await setRoleFn({ data: { userId, role: nextRole } });
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: usersQueryOptions.queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: userStatsQueryOptions.queryKey,
				}),
			]);
			setOpen(false);
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Could not change that role.",
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setError(null);
			}}
		>
			<AlertDialogTrigger asChild>
				<Button variant="ghost" size="sm">
					{promoting ? (
						<ShieldCheck className="size-4" />
					) : (
						<ShieldOff className="size-4" />
					)}
					{promoting ? "Make admin" : "Make leader"}
				</Button>
			</AlertDialogTrigger>

			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{promoting ? `Make ${name} an admin?` : `Make ${name} a leader?`}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{promoting
							? `${name} will be able to see and manage everything — every member, every leader, settings, the review queue.`
							: `${name} will lose admin access and go back to seeing only their own members and sub-leaders.`}
					</AlertDialogDescription>
				</AlertDialogHeader>

				{error ? (
					<p
						role="alert"
						className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
					>
						{error}
					</p>
				) : null}

				<AlertDialogFooter>
					<AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={pending}
						onClick={(event) => {
							// Keep the dialog mounted so a server refusal stays readable.
							event.preventDefault();
							void confirm();
						}}
					>
						{pending ? "Saving…" : promoting ? "Make admin" : "Make leader"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
