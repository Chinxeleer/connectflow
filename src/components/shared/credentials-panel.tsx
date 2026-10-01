import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog.tsx";

export type GrantedCredentials = {
	name: string;
	email: string;
	temporaryPassword: string;
};

/**
 * Shown once right after an account is created — the password is not
 * recoverable afterwards, so this is the only place it's ever displayed.
 * Shared by `create-user` (a brand-new, unlinked account) and
 * `grant-member-access` (an account linked to an existing member).
 */
export function CredentialsPanel({
	created,
	title,
	onDone,
	onAddAnother,
}: {
	created: GrantedCredentials;
	title: string;
	onDone: () => void;
	onAddAnother?: () => void;
}) {
	const [copied, setCopied] = useState(false);

	return (
		<>
			<DialogHeader>
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>
					This password is shown once and cannot be retrieved later. Send it to
					them directly — there is no password-reset email yet.
				</DialogDescription>
			</DialogHeader>

			<div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
				<div className="flex flex-col gap-1">
					<span className="text-muted-foreground text-xs">Email</span>
					<span className="font-medium break-all">{created.email}</span>
				</div>
				<div className="flex flex-col gap-1">
					<span className="text-muted-foreground text-xs">
						Temporary password
					</span>
					<div className="flex items-center gap-2">
						<code className="flex-1 rounded-md border bg-background px-3 py-2 font-mono text-sm break-all">
							{created.temporaryPassword}
						</code>
						<Button
							type="button"
							variant="outline"
							size="icon"
							aria-label="Copy password"
							onClick={async () => {
								await navigator.clipboard.writeText(created.temporaryPassword);
								setCopied(true);
								setTimeout(() => setCopied(false), 2000);
							}}
						>
							{copied ? (
								<Check className="size-4" />
							) : (
								<Copy className="size-4" />
							)}
						</Button>
					</div>
				</div>
			</div>

			<DialogFooter>
				{onAddAnother ? (
					<Button type="button" variant="outline" onClick={onAddAnother}>
						Add another
					</Button>
				) : null}
				<Button type="button" onClick={onDone}>
					Done
				</Button>
			</DialogFooter>
		</>
	);
}
