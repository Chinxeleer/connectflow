import { useStore } from "@tanstack/react-store";
import { Laptop, Moon, Sun } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import { setTheme, type Theme, themeStore } from "@/lib/theme-store.ts";

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Laptop },
];

export function ThemeToggle() {
	const theme = useStore(themeStore);

	return (
		<ToggleGroup
			type="single"
			variant="outline"
			value={theme}
			onValueChange={(value) => {
				// Radix fires `onValueChange("")` when clicking the already-selected
				// item — ignore that instead of landing on an empty theme.
				if (value) setTheme(value as Theme);
			}}
			aria-label="Theme"
		>
			{OPTIONS.map((option) => (
				<ToggleGroupItem key={option.value} value={option.value}>
					<option.icon className="size-4" />
					{option.label}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
