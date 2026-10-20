import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card.tsx";
import { INTAKE_FORM_URL } from "@/lib/intake-form.ts";

/**
 * Lets anyone signed in grab the intake form's link to hand to a prospective
 * member — the form itself has no login, so the link is the whole hand-off.
 */
export function IntakeFormLink() {
	const [copied, setCopied] = useState(false);

	return (
		<Card className="mx-4 lg:mx-6">
			<CardHeader>
				<CardTitle className="text-base">Intake form</CardTitle>
				<CardDescription>
					Share this with anyone who wants to join a connect.
				</CardDescription>
				<CardAction>
					<Button variant="outline" size="sm" asChild>
						<a href={INTAKE_FORM_URL} target="_blank" rel="noreferrer">
							<ExternalLink className="size-4" />
							Open
						</a>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<div className="flex items-center gap-2">
					<code className="bg-muted flex-1 truncate rounded-md border px-3 py-2 font-mono text-sm">
						{INTAKE_FORM_URL}
					</code>
					<Button
						type="button"
						variant="outline"
						size="icon"
						aria-label="Copy intake form link"
						onClick={async () => {
							await navigator.clipboard.writeText(INTAKE_FORM_URL);
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
			</CardContent>
		</Card>
	);
}
