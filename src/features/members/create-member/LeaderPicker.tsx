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
import { membersQueryOptions } from "@/features/members/member-list/action.ts";
import { cn } from "@/lib/utils.ts";

const UNASSIGNED = "__unassigned__";

/**
 * Searchable connect-leader picker. Only admins see this — a leader's new
 * member always goes onto their own connect, decided server-side.
 *
 * Options come from the members list, which is already scoped and cached, so
 * this needs no endpoint of its own.
 */
export function LeaderPicker({
	value,
	onChange,
	id,
}: {
	value: string | null;
	onChange: (leaderId: string | null) => void;
	id?: string;
}) {
	const { data, isPending } = useQuery(membersQueryOptions);
	const [open, setOpen] = useState(false);

	const options = data ?? [];
	const selected = options.find((member) => member.id === value);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					// biome-ignore lint/a11y/useSemanticElements: combobox trigger
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
