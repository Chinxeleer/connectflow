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

/**
 * Searchable "which member is this?" picker for resolving a removal request.
 * Mechanically the same idea as `LeaderPicker`, but there is no "none" option
 * here — resolving means naming an actual person, never leaving it blank —
 * so this stays its own small component rather than stretching that one's
 * copy to fit a different action.
 */
export function MemberPicker({
	value,
	onChange,
}: {
	value: string | null;
	onChange: (memberId: string) => void;
}) {
	const { data, isPending } = useQuery(membersQueryOptions);
	const [open, setOpen] = useState(false);

	const options = data ?? [];
	const selected = options.find((member) => member.id === value);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
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
							{isPending ? "Loading members…" : "Select a member…"}
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
							{options.map((member) => (
								<CommandItem
									key={member.id}
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
