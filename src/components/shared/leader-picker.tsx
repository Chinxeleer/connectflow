import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command.tsx";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { assignablePeopleQueryOptions } from "@/features/members/member-list/action.ts";
import { cn } from "@/lib/utils.ts";

const UNASSIGNED = "__unassigned__";

/**
 * Searchable connect-leader picker, shared by the add-member dialog and the
 * profile editor. Only admins see it — a leader's new member always goes onto
 * their own connect, and reassignment is admin-only, both decided server-side.
 *
 * Deliberately reads from `assignablePeopleQueryOptions`, not the member
 * roster — an `isOrganization` entity like "ENC" is excluded from the roster
 * but must still be pickable as a leader.
 */
export function LeaderPicker({
	value,
	onChange,
	id,
	excludeId,
}: {
	value: string | null;
	onChange: (leaderId: string | null) => void;
	id?: string;
	/**
	 * A member who must not appear as their own leader. Convenience only — the
	 * schema rejects it and the server refuses any loop regardless.
	 */
	excludeId?: string;
}) {
	const { data, isPending } = useQuery(assignablePeopleQueryOptions);
	const [open, setOpen] = useState(false);

	const options = (data ?? []).filter((member) => member.id !== excludeId);
	const selected = options.find((member) => member.id === value);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between font-normal"
				>
					{selected ? (
						selected.name
					) : (
						<span className="text-muted-foreground">
							{isPending ? "Loading members…" : "No connect leader"}
						</span>
					)}
					<ChevronsUpDown className="size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>

			<PopoverContent
				className="w-(--radix-popover-trigger-width) p-0"
				align="start"
			>
				<Command>
					<CommandInput placeholder="Search members…" />
					<CommandList>
						<CommandEmpty>No member by that name.</CommandEmpty>
						<CommandGroup>
							<CommandItem
								value={UNASSIGNED}
								onSelect={() => {
									onChange(null);
									setOpen(false);
								}}
							>
								<Check
									className={cn(
										"size-4",
										value === null ? "opacity-100" : "opacity-0",
									)}
								/>
								<span className="text-muted-foreground">No connect leader</span>
							</CommandItem>

							{options.map((member) => (
								<CommandItem
									key={member.id}
									// Searched by name; the id is what we actually store.
									value={`${member.name} ${member.id}`}
									onSelect={() => {
										onChange(member.id);
										setOpen(false);
									}}
								>
									<Check
										className={cn(
											"size-4",
											value === member.id ? "opacity-100" : "opacity-0",
										)}
									/>
									{member.name}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
