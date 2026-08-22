import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Integration tests read DATABASE_URL the same way drizzle.config.ts does.
config({ path: [".env.local", ".env"] });

export default defineConfig({
	resolve: { tsconfigPaths: true },
	test: {
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
	},
});
