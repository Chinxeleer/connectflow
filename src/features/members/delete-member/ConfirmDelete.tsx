import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
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
import {
	assignablePeopleQueryOptions,
	membersQueryOptions,
} from "@/features/members/member-list/action.ts";
import { memberStatsQueryOptions } from "@/features/members/member-stats/action.ts";
import { deleteMember } from "./action.ts";

/**
 * Hard-delete confirmation. The copy says plainly that this cannot be undone,
 * because it genuinely cannot — there is no soft-delete column.
 *
 * A refusal from the server (the member leads people) is shown in place and
 * leaves the dialog open, so the reason is readable rather than flashing past.
 */
export function ConfirmDeleteMember({
	member,
}: {
	member: { id: string; name: string };
}) {
	const deleteMemberFn = useServerFn(deleteMember);
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function confirm() {
		setPending(true);
		setError(null);
		try {
			await deleteMemberFn({ data: { id: member.id } });
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: membersQueryOptions.queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: assignablePeopleQueryOptions.queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: memberStatsQueryOptions.queryKey,
				}),
			]);
			setOpen(false);
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "That member could not be deleted.",
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
				<Button
					variant="ghost"
					size="sm"
					className="text-destructive hover:text-destructive"
				>
					<Trash2 className="size-4" />
					<span className="sr-only sm:not-sr-only">Delete</span>
				</Button>
			</AlertDialogTrigger>

			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete {member.name}?</AlertDialogTitle>
					<AlertDialogDescription>
						This permanently removes {member.name} and cannot be undone. Their
						attendance history and any record of them goes with it.
					</AlertDialogDescription>
				</AlertDialogHeader>

				{error ? (
					<p
						role="alert"
						className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
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
						className="bg-destructive text-white hover:bg-destructive/90"
					>
						{pending ? "Deleting…" : "Delete permanently"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
