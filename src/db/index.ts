import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "./schema/index.ts";

/**
 * Neon's WebSocket pool rather than `drizzle-orm/node-postgres`: this app's SSR
 * runs on workerd (both `pnpm dev` and the deployed Worker), which has no raw
 * TCP, so the `pg` driver hangs there.
 *
 * The WebSocket driver — unlike Neon's HTTP driver — supports real transactions,
 * which better-auth needs so a failed sign-up cannot leave an orphaned user row.
 */
neonConfig.poolQueryViaFetch = true;

export const db = drizzle(
	new Pool({ connectionString: process.env.DATABASE_URL as string }),
	{ schema },
);
