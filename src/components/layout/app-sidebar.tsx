import { Link } from "@tanstack/react-router";
import {
	CalendarCheck,
	ClipboardList,
	LayoutDashboard,
	Network,
	Settings,
	ShieldCheck,
	UsersRound,
	Waypoints,
} from "lucide-react";
import type { ComponentProps } from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar.tsx";
import { APP_NAME } from "@/lib/app.ts";
import { isAdmin } from "@/lib/permissions.ts";
import { NavUser } from "./nav-user.tsx";

/**
 * Sections that exist as routes today.
 */
const navMain = [
	{ title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
	{ title: "Members", to: "/members", icon: UsersRound },
	{ title: "Hierarchy", to: "/hierarchy", icon: Network },
] as const;

/** Routes only an admin may open; the pages behind them reject leaders. */
const navAdmin = [{ title: "Users", to: "/users", icon: ShieldCheck }] as const;

/**
 * The rest of the product per the spec. Rendered disabled rather than as links,
 * so the shape of the app is visible without any nav item 404-ing.
 */
const navPlanned = [
	{ title: "Leaders", icon: CalendarCheck },
	{ title: "Review queue", icon: ClipboardList },
	{ title: "Settings", icon: Settings },
] as const;

export function AppSidebar({
	user,
	...props
}: ComponentProps<typeof Sidebar> & {
	user: { name: string; email: string; role?: string | null };
}) {
	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							className="data-[slot=sidebar-menu-button]:!p-1.5"
						>
							<Link to="/dashboard">
								<Waypoints className="!size-5" />
								<span className="text-base font-semibold">{APP_NAME}</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent className="flex flex-col gap-2">
						<SidebarMenu>
							{navMain.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton asChild tooltip={item.title}>
										<Link to={item.to} activeProps={{ "data-active": true }}>
											<item.icon />
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
							{isAdmin(user)
								? navAdmin.map((item) => (
										<SidebarMenuItem key={item.title}>
											<SidebarMenuButton asChild tooltip={item.title}>
												<Link
													to={item.to}
													activeProps={{ "data-active": true }}
												>
													<item.icon />
													<span>{item.title}</span>
												</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))
								: null}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Not built yet</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navPlanned.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										disabled
										tooltip={`${item.title} — not built yet`}
										className="cursor-not-allowed opacity-50"
									>
										<item.icon />
										<span>{item.title}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<NavUser user={user} />
			</SidebarFooter>
		</Sidebar>
	);
}
