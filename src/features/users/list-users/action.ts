import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { selectAllUsers } from "./query.ts";

export const listUsers = createServerFn({ method: "GET" }).handler(async () => {
	const { headers } = getRequest();
	const session = await auth.api.getSession({ headers });

	requireAdmin(session?.user);

	return await selectAllUsers();
});

export const usersQueryOptions = queryOptions({
	queryKey: ["users", "list"] as const,
	queryFn: () => listUsers(),
});
