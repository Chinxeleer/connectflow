import { describe, expect, it } from "vitest";
import { averageConnectSize, type ConnectOverview } from "./query.ts";

const overview = (partial: Partial<ConnectOverview>): ConnectOverview => ({
	totalMembers: 0,
	withoutConnect: 0,
	activeConnects: 0,
	membersInAConnect: 0,
	largestConnect: 0,
	female: 0,
	male: 0,
	...partial,
});

describe("averageConnectSize", () => {
	it("divides members in a connect by the number of connects", () => {
		expect(
			averageConnectSize(
				overview({ activeConnects: 49, membersInAConnect: 125 }),
			),
		).toBe(2.6);
	});

	it("returns 0 rather than NaN when there are no connects", () => {
		// A fresh system must not render "NaN members each".
		expect(averageConnectSize(overview({ activeConnects: 0 }))).toBe(0);
		expect(
			averageConnectSize(overview({ activeConnects: 0, membersInAConnect: 0 })),
		).not.toBeNaN();
	});

	it("rounds to one decimal place", () => {
		expect(
			averageConnectSize(
				overview({ activeConnects: 3, membersInAConnect: 10 }),
			),
		).toBe(3.3);
		expect(
			averageConnectSize(
				overview({ activeConnects: 7, membersInAConnect: 12 }),
			),
		).toBe(1.7);
	});

	it("handles an exact whole number", () => {
		expect(
			averageConnectSize(
				overview({ activeConnects: 5, membersInAConnect: 10 }),
			),
		).toBe(2);
	});
});
