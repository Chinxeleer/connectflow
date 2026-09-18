import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { AreaGroupBadge } from "@/components/shared/area-group-badge.tsx";
import { MinistryBadge } from "@/components/shared/ministry-badge.tsx";
import { MemberStatusBadge } from "@/components/shared/status-badge.tsx";
import { YearOfStudyBadge } from "@/components/shared/year-of-study-badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card.tsx";
import { UpdateMemberProfileForm } from "../update-member-profile/Form.tsx";
import { memberDetailQueryOptions } from "./action.ts";

/**
 * Blank profile fields are the normal state for an imported row, until the
 * member backfills them — so they read as "Not set", never as an empty gap the
 * reader has to interpret.
 */
function DetailRow({
	label,
	children,
}: {
	label: string;
	children?: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1 border-b py-3 last:border-b-0 sm:flex-row sm:gap-4">
			<dt className="text-muted-foreground w-48 shrink-0 text-sm">{label}</dt>
			<dd className="text-sm">
				{children ?? (
					<span className="text-muted-foreground italic">Not set</span>
				)}
			</dd>
		</div>
	);
}

function Refused({ title, body }: { title: string; body: string }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{body}</CardDescription>
			</CardHeader>
			<CardContent>
				<Button variant="outline" asChild>
					<Link to="/members">Back to members</Link>
				</Button>
			</CardContent>
		</Card>
	);
}

export function MemberProfile({ memberId }: { memberId: string }) {
	const { data } = useSuspenseQuery(memberDetailQueryOptions(memberId));
	const [editing, setEditing] = useState(false);

	if (data.status === "not-found") {
		return (
			<Refused
				title="That member no longer exists."
				body="They may have been removed since this link was made."
			/>
		);
	}

	// Not a redirect: `_authed` has already established there is a session, so
	// this is authorisation, not authentication. Bouncing to the dashboard would
	// leave the reader guessing why.
	if (data.status === "forbidden") {
		return (
			<Refused
				title="You do not have permission to open this profile."
				body="You can see the members in your own connect and everyone below them."
			/>
		);
	}

	const { member, permissions } = data;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{member.name}</CardTitle>
				<CardDescription>
					{member.reports.length > 0
						? `Leads ${member.reports.length} ${member.reports.length === 1 ? "member" : "members"} directly.`
						: "Leads nobody at the moment."}
				</CardDescription>
				{permissions.canEditProfile && !editing ? (
					<CardAction>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setEditing(true)}
						>
							<Pencil className="size-4" />
							Edit profile
						</Button>
					</CardAction>
				) : null}
			</CardHeader>

			<CardContent>
				{editing ? (
					<UpdateMemberProfileForm
						member={member}
						permissions={permissions}
						onSaved={() => setEditing(false)}
						onCancel={() => setEditing(false)}
					/>
				) : (
					<dl>
						<DetailRow label="Status">
							<MemberStatusBadge status={member.status} />
						</DetailRow>

						<DetailRow label="Connect leader">
							{member.leaderId && member.leaderName ? (
								<Link
									to="/members/$memberId"
									params={{ memberId: member.leaderId }}
									className="underline-offset-4 hover:underline"
								>
									{member.leaderName}
								</Link>
							) : (
								<span className="text-muted-foreground italic">Unassigned</span>
							)}
						</DetailRow>

						<DetailRow label="Members led directly">
							{member.reports.length > 0 ? (
								<ul>
									{member.reports.map((report) => (
										<li key={report.id}>{report.name}</li>
									))}
								</ul>
							) : undefined}
						</DetailRow>

						<DetailRow label="Phone">{member.phone}</DetailRow>
						<DetailRow label="Email">{member.email}</DetailRow>
						<DetailRow label="Gender">{member.gender}</DetailRow>
						<DetailRow label="Residence">{member.residence}</DetailRow>
						<DetailRow label="Field of study">{member.fieldOfStudy}</DetailRow>
						<DetailRow label="Year of study">
							{member.yearOfStudy ? (
								<YearOfStudyBadge yearOfStudy={member.yearOfStudy} />
							) : undefined}
						</DetailRow>
						<DetailRow label="Area group">
							{member.areaGroup ? (
								<AreaGroupBadge areaGroup={member.areaGroup} />
							) : undefined}
						</DetailRow>
						<DetailRow label="Ministry">
							{member.ministry ? (
								<MinistryBadge ministry={member.ministry} />
							) : undefined}
						</DetailRow>
						<DetailRow label="Sign-in account">
							{member.hasAccount ? "Linked" : undefined}
						</DetailRow>
					</dl>
				)}
			</CardContent>
		</Card>
	);
}
