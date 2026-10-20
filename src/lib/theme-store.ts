import { Store } from "@tanstack/store";

export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";

function systemPrefersDark(): boolean {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-color-scheme: dark)").matches
	);
}

function readStoredTheme(): Theme {
	if (typeof window === "undefined") return "system";
	try {
		const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
		return stored === "light" || stored === "dark" ? stored : "system";
	} catch {
		return "system";
	}
}

/**
 * Toggles the `.dark` class Tailwind's `@custom-variant dark` keys off of.
 * Also run, inline and blocking, by the script in `__root.tsx` before
 * hydration — that copy can't import this module (it runs before any JS
 * bundle loads), so the logic is deliberately kept simple enough to
 * duplicate by hand without drifting.
 */
function applyTheme(theme: Theme): void {
	if (typeof document === "undefined") return;
	const dark = theme === "dark" || (theme === "system" && systemPrefersDark());
	document.documentElement.classList.toggle("dark", dark);
}

export const themeStore = new Store<Theme>(readStoredTheme());

export function setTheme(theme: Theme): void {
	themeStore.setState(() => theme);
	applyTheme(theme);
	try {
		window.localStorage.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		// Private browsing / blocked storage — the theme still applies for
		// this page view, it just won't be remembered next visit.
	}
}
