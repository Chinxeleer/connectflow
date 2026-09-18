import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CircleCheck, FileUp, TriangleAlert, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
	assignablePeopleQueryOptions,
	membersQueryOptions,
} from "@/features/members/member-list/action.ts";
import { memberStatsQueryOptions } from "@/features/members/member-stats/action.ts";
import { cn } from "@/lib/utils.ts";
import { type ImportResult, importMembersCsv } from "./action.ts";
import type { AmbiguousLeaderLabel } from "./csv-mapping.ts";

/**
 * Review step. Shown *instead of* closing, so the labels that need a human
 * decision are not lost the moment the import halts.
 */
function ReviewStep({
	ambiguous,
	onBack,
}: {
	ambiguous: AmbiguousLeaderLabel[];
	onBack: () => void;
}) {
	return (
		<>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
					Leader names need review
				</DialogTitle>
				<DialogDescription>
					Nothing was imported. These leader names in the file could not be
					matched to exactly one member, and guessing would attach whole groups
					to the wrong person.
				</DialogDescription>
			</DialogHeader>

			<ul className="flex max-h-72 flex-col gap-3 overflow-y-auto">
				{ambiguous.map((item) => (
					<li
						key={item.baseName}
						className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
					>
						<p className="font-medium">{item.baseName}</p>
						<p className="text-muted-foreground mt-1">
							{item.reason === "no-match"
								? "No member with this name exists yet — add them first, or correct the spelling in the file."
								: `Matches ${item.candidates.length} members with the same name — rename one so they can be told apart.`}
						</p>
						<p className="text-muted-foreground mt-2 text-xs">
							In the file as:{" "}
							{item.labels.map((label) => (
								<code
									key={label}
									className="bg-background mr-1 rounded border px-1 py-0.5"
								>
									{label}
								</code>
							))}
						</p>
					</li>
				))}
			</ul>

			<DialogFooter>
				<Button type="button" variant="outline" onClick={onBack}>
					Choose another file
				</Button>
			</DialogFooter>
		</>
	);
}

/**
 * Shown after a successful import that did something worth reporting —
 * leaders created, or rows skipped. A clean import closes straight away.
 */
function SummaryStep({
	result,
	onDone,
}: {
	result: Extract<ImportResult, { status: "imported" }>;
	onDone: () => void;
}) {
	return (
		<>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
					Imported {result.inserted} members
				</DialogTitle>
				<DialogDescription>
					{result.linked} linked to a connect leader, {result.unassigned} still
					unassigned.
				</DialogDescription>
			</DialogHeader>

			<div className="flex max-h-72 flex-col gap-3 overflow-y-auto text-sm">
				{result.leadersCreated.length > 0 ? (
					<div className="rounded-lg border p-3">
						<p className="font-medium">
							Added as new members, because they lead people but were not listed
							themselves
						</p>
						<ul className="text-muted-foreground mt-2 list-disc pl-4">
							{result.leadersCreated.map((name) => (
								<li key={name}>{name}</li>
							))}
						</ul>
					</div>
				) : null}

				{result.issues.length > 0 ? (
					<div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
						<p className="font-medium">
							{result.issues.length} row
							{result.issues.length === 1 ? "" : "s"} skipped
						</p>
						<ul className="text-muted-foreground mt-2 list-disc pl-4">
							{result.issues.slice(0, 10).map((issue) => (
								<li key={`${issue.row}-${issue.message}`}>
									Row {issue.row}: {issue.message}
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

export function ImportCsvForm({ onImported }: { onImported: () => void }) {
	const importFn = useServerFn(importMembersCsv);
	const queryClient = useQueryClient();
	const inputRef = useRef<HTMLInputElement>(null);

	const [file, setFile] = useState<File | null>(null);
	const [dragging, setDragging] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [review, setReview] = useState<AmbiguousLeaderLabel[] | null>(null);
	const [summary, setSummary] = useState<Extract<
		ImportResult,
		{ status: "imported" }
	> | null>(null);

	function accept(candidate: File | undefined) {
		setError(null);
		if (!candidate) return;

		if (!candidate.name.toLowerCase().endsWith(".csv")) {
			setError("That is not a .csv file.");
			return;
		}

		setFile(candidate);
	}

	async function submit() {
		if (!file) return;

		setPending(true);
		setError(null);

		try {
			const csv = await file.text();
			const result: ImportResult = await importFn({
				data: { fileName: file.name, csv },
			});

			if (result.status === "needs-review") {
				setReview(result.ambiguous);
				return;
			}

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

			// Only pause on the way out if there is something to tell them.
			if (result.leadersCreated.length > 0 || result.issues.length > 0) {
				setSummary(result);
				return;
			}

			onImported();
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "That import failed.",
			);
		} finally {
			setPending(false);
		}
	}

	if (summary) {
		return <SummaryStep result={summary} onDone={onImported} />;
	}

	if (review) {
		return (
			<ReviewStep
				ambiguous={review}
				onBack={() => {
					setReview(null);
					setFile(null);
				}}
			/>
		);
	}

	return (
		<>
			<DialogHeader>
				<DialogTitle>Import members from CSV</DialogTitle>
				<DialogDescription>
					A blank leader cell inherits the leader above it. Group labels like
					"Grace Hopper - Group A" resolve to the leader's name.
				</DialogDescription>
			</DialogHeader>

			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				onDragOver={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(event) => {
					event.preventDefault();
					setDragging(false);
					accept(event.dataTransfer.files[0]);
				}}
				className={cn(
					"flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
					dragging
						? "border-primary bg-primary/5"
						: "hover:border-muted-foreground/50",
				)}
			>
				<FileUp className="text-muted-foreground size-6" />
				{file ? (
					<>
						<span className="text-sm font-medium">{file.name}</span>
						<span className="text-muted-foreground text-xs">
							{(file.size / 1024).toFixed(1)} KB — click to choose another
						</span>
					</>
				) : (
					<>
						<span className="text-sm font-medium">
							Drop a .csv here, or click to browse
						</span>
						<span className="text-muted-foreground text-xs">
							One file, up to 2MB
						</span>
					</>
				)}
			</button>

			<input
				ref={inputRef}
				type="file"
				accept=".csv,text/csv"
				className="hidden"
				onChange={(event) => accept(event.target.files?.[0])}
			/>

			{error ? (
				<p
					role="alert"
					className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
				>
					{error}
				</p>
			) : null}

			<DialogFooter>
				<Button type="button" disabled={!file || pending} onClick={submit}>
					<Upload className="size-4" />
					{pending ? "Importing…" : "Import"}
				</Button>
			</DialogFooter>
		</>
	);
}
