import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "@/db/index.ts";
import {
	account,
	rateLimit,
	session,
	user,
	verification,
} from "@/db/schema/auth.ts";
import { ac, roles } from "./permissions-ac.ts";

export const auth = betterAuth({
	appName: "ConnectFlow",
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: { user, session, account, verification, rateLimit },
	}),
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		// No transactional email provider is wired yet, so verification links
		// would go nowhere. Flip this on together with `emailVerification`.
		requireEmailVerification: false,
		autoSignIn: true,
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 24,
		cookieCache: { enabled: true, maxAge: 5 * 60 },
	},
	rateLimit: {
		enabled: true,
		storage: "database",
	},
	advanced: {
		// Deployed behind Cloudflare, which sets this header on every request.
		ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
	},
	plugins: [
		// Supplies `role` on the user plus the admin-only user-management API
		// (`auth.api.createUser`), which is how accounts are made here — there is
		// no public sign-up route.
		admin({ ac, roles, adminRoles: ["admin"], defaultRole: "leader" }),
		tanstackStartCookies(),
	],
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
