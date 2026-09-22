import { describe, expect, it } from "vitest";
import { attentionReasonFor } from "./query.ts";

describe("attentionReasonFor", () => {
	it("flags both problems when the member has no leader and leads nobody", () => {
		expect(attentionReasonFor({ leaderId: null, notLeading: true })).toBe(
			"no_leader_and_not_leading",
		);
	});

	it("flags a missing leader alone when the member is otherwise leading someone", () => {
		expect(attentionReasonFor({ leaderId: null, notLeading: false })).toBe(
			"no_leader",
		);
	});

	it("flags not-leading alone when the member has a leader assigned", () => {
		expect(attentionReasonFor({ leaderId: "some-id", notLeading: true })).toBe(
			"not_leading",
		);
	});
});
