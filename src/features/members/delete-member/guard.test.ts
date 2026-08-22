import { describe, expect, it } from "vitest";
import { decideDelete } from "./guard.ts";

describe("decideDelete", () => {
	it("allows deleting a member nobody reports to", () => {
		expect(
			decideDelete({
				memberExists: true,
				memberName: "Ada Lovelace",
				reportCount: 0,
			}),
		).toEqual({ allowed: true });
	});

	it("blocks a member who leads people, naming them and the count", () => {
		const decision = decideDelete({
			memberExists: true,
			memberName: "Grace Hopper",
			reportCount: 4,
		});

		expect(decision.allowed).toBe(false);
		expect(decision).toMatchObject({
			reason: "4 people report to Grace Hopper — reassign them first.",
		});
	});

	it("uses the singular for exactly one report", () => {
		expect(
			decideDelete({
				memberExists: true,
				memberName: "Grace Hopper",
				reportCount: 1,
			}),
		).toMatchObject({
			reason: "1 person reports to Grace Hopper — reassign them first.",
		});
	});

	it("never allows a delete that would orphan reports", () => {
		for (const reportCount of [1, 2, 10, 500]) {
			expect(
				decideDelete({ memberExists: true, memberName: "X", reportCount })
					.allowed,
			).toBe(false);
		}
	});

	it("blocks a member that no longer exists", () => {
		expect(
			decideDelete({ memberExists: false, memberName: "X", reportCount: 0 }),
		).toEqual({ allowed: false, reason: "That member no longer exists." });
	});

	it("blocks a missing member even when the report count is zero", () => {
		expect(
			decideDelete({ memberExists: false, memberName: "X", reportCount: 0 })
				.allowed,
		).toBe(false);
	});
});
