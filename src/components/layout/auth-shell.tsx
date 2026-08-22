import { Link } from "@tanstack/react-router";
import { Waypoints } from "lucide-react";
import type { ReactNode } from "react";

const highlights = [
	"Intake straight from the sign-up form",
	"Matching that respects leader capacity",
	"Induction tracked to the last follow-up",
];

/**
 * Two-column auth layout: form on the left, brand panel on the right.
 * Mirrors the shadcn `login-02` block, with the cover image replaced by a
 * panel built from the app's own palette.
 */
export function AuthShell({ children }: { children: ReactNode }) {
	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<Link to="/" className="flex items-center gap-2 font-medium">
						<div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
							<Waypoints className="size-4" />
						</div>
						ConnectFlow
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-xs">{children}</div>
				</div>
			</div>
			<div className="relative hidden overflow-hidden lg:block">
				<div
					aria-hidden
					className="absolute inset-0 bg-[linear-gradient(155deg,var(--chart-5)_0%,var(--chart-4)_45%,var(--chart-3)_100%)]"
				/>
				<div
					aria-hidden
					className="absolute inset-0 bg-[radial-gradient(620px_420px_at_82%_8%,rgba(255,255,255,0.22),transparent_62%),radial-gradient(520px_380px_at_10%_96%,rgba(255,255,255,0.14),transparent_66%)]"
				/>
				<div className="relative flex h-full flex-col justify-end gap-8 p-12 text-white">
					<blockquote className="max-w-md space-y-4">
						<p className="text-3xl leading-tight font-semibold text-balance">
							Every new face lands with a leader who is expecting them.
						</p>
						<footer className="text-sm text-white/70">
							Connect groups, end to end.
						</footer>
					</blockquote>
					<ul className="space-y-2 text-sm text-white/80">
						{highlights.map((item) => (
							<li key={item} className="flex items-center gap-3">
								<span
									aria-hidden
									className="size-1.5 shrink-0 rounded-full bg-white/60"
								/>
								{item}
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}
