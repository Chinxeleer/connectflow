import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
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
	dismissPendingRemoval,
	pendingRemovalsQueryOptions,
} from "./action.ts";

/**
 * Dismissing means this request does not apply to anyone — a typo, a
 * duplicate submission, spam — and leaves every member record untouched.
 */
export function DismissPendingRemovalButton({
	pendingRemovalId,
	firstName,
	surname,
}: {
	pendingRemovalId: string;
	firstName: string;
	surname: string;
}) {
	const dismissFn = useServerFn(dismissPendingRemoval);
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function confirm() {
		setPending(true);
		setError(null);
		try {
			await dismissFn({ data: { pendingRemovalId } });
			await queryClient.invalidateQueries({
				queryKey: pendingRemovalsQueryOptions.queryKey,
			});
			setOpen(false);
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Could not dismiss that request.",
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
				<Button variant="ghost" size="sm" className="text-muted-foreground">
					<X className="size-4" />
					Dismiss
				</Button>
			</AlertDialogTrigger>

			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Dismiss the request for "{firstName} {surname}"?
					</AlertDialogTitle>
					<AlertDialogDescription>
						No member record is changed. Use this when the request doesn't apply
						to anyone — a typo, a duplicate, or spam.
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
							event.preventDefault();
							void confirm();
						}}
					>
						{pending ? "Dismissing…" : "Dismiss"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
