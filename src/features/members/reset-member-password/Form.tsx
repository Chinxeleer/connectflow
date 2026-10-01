import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import {
	CredentialsPanel,
	type GrantedCredentials,
} from "@/components/shared/credentials-panel.tsx";
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
import { FieldError } from "@/components/ui/field.tsx";
import { resetMemberPassword } from "./action.ts";

export function ResetMemberPasswordDialog({
	memberId,
	memberName,
}: {
	memberId: string;
	memberName: string;
}) {
	const resetMemberPasswordFn = useServerFn(resetMemberPassword);
	const [open, setOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [created, setCreated] = useState<GrantedCredentials | null>(null);
	const [formError, setFormError] = useState<string | null>(null);

	function reset() {
		setCreated(null);
		setFormError(null);
	}

	async function handleReset() {
		setSubmitting(true);
		setFormError(null);
		try {
			const result = await resetMemberPasswordFn({ data: { memberId } });
			setCreated(result);
		} catch (error) {
			setFormError(
				error instanceof Error
					? error.message
					: "Could not reset that password.",
			);
		} finally {
			setSubmitting(false);
		}
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
				<Button variant="outline" size="sm">
					<KeyRound className="size-4" />
					Reset password
				</Button>
			</DialogTrigger>

			<DialogContent className="sm:max-w-md">
				{created ? (
					<CredentialsPanel
						created={created}
						title={`${created.name}'s password has been reset`}
						onDone={() => setOpen(false)}
					/>
				) : (
					<>
						<DialogHeader>
							<DialogTitle>Reset {memberName}'s password?</DialogTitle>
							<DialogDescription>
								Their current password stops working immediately. A new
								temporary password is generated and shown once — send it to them
								directly, there is no password-reset email yet.
							</DialogDescription>
						</DialogHeader>

						{formError ? (
							<FieldError role="alert">{formError}</FieldError>
						) : null}

						<DialogFooter>
							<Button type="button" disabled={submitting} onClick={handleReset}>
								{submitting ? "Resetting…" : "Reset password"}
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
