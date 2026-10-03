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
import { APP_NAME } from "./app.ts";
import { renderEmailLayout, sendEmail } from "./email-client.ts";
import { ac, roles } from "./permissions-ac.ts";

export const auth = betterAuth({
	appName: APP_NAME,
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: { user, session, account, verification, rateLimit },
	}),
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		// Not required to sign in: accounts are admin-created with a temporary
		// password and expected to work immediately, not block on a clicked
		// link. The email still goes out — this only governs whether it's
		// enforced.
		requireEmailVerification: false,
		autoSignIn: true,
		sendResetPassword: async ({ user: recipient, url }) => {
			try {
				await sendEmail({
					to: recipient.email,
					subject: `Reset your ${APP_NAME} password`,
					html: renderEmailLayout({
						heading: "Reset your password",
						bodyHtml: `<p>We got a request to reset the password on your ${APP_NAME} account. This link is valid for one hour — if you didn't ask for this, you can ignore it.</p>`,
						action: { label: "Reset password", url },
					}),
				});
			} catch (error) {
				console.error("Failed to send password reset email", error);
			}
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user: recipient, url }) => {
			try {
				await sendEmail({
					to: recipient.email,
					subject: `Verify your ${APP_NAME} email`,
					html: renderEmailLayout({
						heading: "Verify your email",
						bodyHtml: `<p>Confirm this is your email address to finish setting up your ${APP_NAME} account.</p>`,
						action: { label: "Verify email", url },
					}),
				});
			} catch (error) {
				console.error("Failed to send verification email", error);
			}
		},
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
