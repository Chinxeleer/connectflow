import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
	ChevronRight,
	ClipboardList,
	Crown,
	LayoutDashboard,
	MapPin,
	Network,
	Settings,
	ShieldCheck,
	UsersRound,
} from "lucide-react";
import type { ComponentProps } from "react";
import { Logo } from "@/components/shared/logo.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx";
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
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar.tsx";
import { AREA_GROUP_LABELS, areaGroup } from "@/db/schema/members.ts";
import { stagingAttentionQueryOptions } from "@/features/intake/staging-summary/index.ts";
import { APP_NAME } from "@/lib/app.ts";
import { isAdmin } from "@/lib/permissions.ts";
import { NavUser } from "./nav-user.tsx";

/**
 * Sections that exist as routes today.
 */
const navMain = [
	{ title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
	{ title: "Members", to: "/members", icon: UsersRound },
	{ title: "Leaders", to: "/leaders", icon: Crown },
	{ title: "Hierarchy", to: "/hierarchy", icon: Network },
] as const;

/** Routes only an admin may open; the pages behind them reject leaders. */
const navAdmin = [{ title: "Users", to: "/users", icon: ShieldCheck }] as const;

/**
 * The rest of the product per the spec. Rendered disabled rather than as links,
 * so the shape of the app is visible without any nav item 404-ing.
 */
const navPlanned = [{ title: "Settings", icon: Settings }] as const;

export function AppSidebar({
	user,
	...props
}: ComponentProps<typeof Sidebar> & {
	user: { name: string; email: string; role?: string | null };
}) {
	const { pathname } = useLocation();
	const onAreasPage = pathname.startsWith("/areas");
	const onStagingPage = pathname.startsWith("/staging");
	const { data: attention } = useQuery({
		...stagingAttentionQueryOptions,
		enabled: isAdmin(user),
	});

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
								<Logo className="h-5 w-auto" />
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
							{isAdmin(user) ? (
								<Collapsible
									defaultOpen={onAreasPage}
									className="group/collapsible"
								>
									<SidebarMenuItem>
										<CollapsibleTrigger asChild>
											<SidebarMenuButton tooltip="Areas">
												<MapPin />
												<span>Areas</span>
												<ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
											</SidebarMenuButton>
										</CollapsibleTrigger>
										<CollapsibleContent>
											<SidebarMenuSub>
												<SidebarMenuSubItem>
													<SidebarMenuSubButton asChild>
														<Link
															to="/areas"
															activeProps={{ "data-active": true }}
															activeOptions={{ exact: true }}
														>
															<span>All areas</span>
														</Link>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
												{areaGroup.enumValues.map((group) => (
													<SidebarMenuSubItem key={group}>
														<SidebarMenuSubButton asChild>
															<Link
																to="/areas/$areaGroup"
																params={{ areaGroup: group }}
																activeProps={{ "data-active": true }}
															>
																<span>{AREA_GROUP_LABELS[group]}</span>
															</Link>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												))}
											</SidebarMenuSub>
										</CollapsibleContent>
									</SidebarMenuItem>
								</Collapsible>
							) : null}
							{isAdmin(user) ? (
								<Collapsible
									defaultOpen={onStagingPage}
									className="group/collapsible"
								>
									<SidebarMenuItem>
										<CollapsibleTrigger asChild>
											<SidebarMenuButton tooltip="Staging">
												<ClipboardList />
												<span>Staging</span>
												<span className="ml-auto flex items-center gap-1">
													{attention && attention.total > 0 ? (
														<Badge
															variant="destructive"
															className="h-5 min-w-5 justify-center rounded-full px-1 text-[10px] tabular-nums"
														>
															{attention.total}
														</Badge>
													) : null}
													<ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
												</span>
											</SidebarMenuButton>
										</CollapsibleTrigger>
										<CollapsibleContent>
											<SidebarMenuSub>
												<SidebarMenuSubItem>
													<SidebarMenuSubButton asChild>
														<Link
															to="/staging/unassigned"
															activeProps={{ "data-active": true }}
														>
															<span>Unassigned</span>
														</Link>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
												<SidebarMenuSubItem>
													<SidebarMenuSubButton asChild>
														<Link
															to="/staging/needs-review"
															activeProps={{ "data-active": true }}
														>
															<span>Needs Review</span>
														</Link>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
												<SidebarMenuSubItem>
													<SidebarMenuSubButton asChild>
														<Link
															to="/staging/removal-requests"
															activeProps={{ "data-active": true }}
														>
															<span>Removal Requests</span>
														</Link>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
											</SidebarMenuSub>
										</CollapsibleContent>
									</SidebarMenuItem>
								</Collapsible>
							) : null}
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
