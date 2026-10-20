import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card.tsx";
import { ChangePasswordForm } from "@/features/settings/change-password/index.ts";
import { ThemeToggle } from "@/features/settings/theme-toggle/index.ts";
import { isAdmin } from "@/lib/permissions.ts";

export const Route = createFileRoute("/_authed/settings")({
	component: SettingsPage,
});

function ProfileField({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-1 border-b py-3 last:border-b-0 sm:flex-row sm:gap-4">
			<dt className="text-muted-foreground w-32 shrink-0 text-sm">{label}</dt>
			<dd className="text-sm">{value}</dd>
		</div>
	);
}

function SettingsPage() {
	const { session } = Route.useRouteContext();
	const admin = isAdmin(session.user);

	return (
		<>
			<SiteHeader title="Settings" />

			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col gap-2">
					<div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
						<div className="flex max-w-xl flex-col gap-6">
							<Card>
								<CardHeader>
									<CardTitle>Profile</CardTitle>
									<CardDescription>
										The account you're signed in as.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<dl>
										<ProfileField label="Name" value={session.user.name} />
										<ProfileField label="Email" value={session.user.email} />
										<div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
											<dt className="text-muted-foreground w-32 shrink-0 text-sm">
												Role
											</dt>
											<dd className="text-sm">
												<Badge variant="outline" className="capitalize">
													{admin ? "Admin" : "Leader"}
												</Badge>
											</dd>
										</div>
									</dl>
								</CardContent>
							</Card>

							<ChangePasswordForm />

							<Card>
								<CardHeader>
									<CardTitle>Appearance</CardTitle>
									<CardDescription>
										Applies on this device only.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<ThemeToggle />
								</CardContent>
							</Card>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
