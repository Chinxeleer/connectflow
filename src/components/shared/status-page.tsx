import type { ReactNode } from "react";
import { cn } from "@/lib/utils.ts";

/**
 * The big stylised code ("404", "500", ...) plus a short explanation and
 * whatever actions make sense to offer — shared by the root-level fallback
 * (rendered before there's any session to trust) and the in-app one (rendered
 * inside the sidebar shell, for a stale link or a broken page once signed in).
 * Deliberately just the content, not a page wrapper — the two call sites need
 * different surrounding chrome (full-bleed vs. inside the existing layout).
 */
export function StatusPage({
	code,
	title,
	description,
	actions,
	className,
}: {
	code: string;
	title: string;
	description: string;
	actions?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col items-center gap-4 px-6 text-center",
				className,
			)}
		>
			<span
				aria-hidden
				className="bg-[linear-gradient(135deg,var(--chart-5)_0%,var(--chart-4)_50%,var(--chart-3)_100%)] bg-clip-text text-8xl leading-none font-black tracking-tight text-transparent sm:text-9xl"
			>
				{code}
			</span>
			<div className="space-y-1.5">
				<h1 className="text-xl font-semibold">{title}</h1>
				<p className="text-muted-foreground max-w-sm text-sm text-balance">
					{description}
				</p>
			</div>
			{actions ? (
				<div className="flex flex-wrap justify-center gap-2 pt-2">
					{actions}
				</div>
			) : null}
		</div>
	);
}
