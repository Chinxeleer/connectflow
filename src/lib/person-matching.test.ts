import { describe, expect, it } from "vitest";
import {
	type MatchCandidatePerson,
	matchPerson,
	matchPersonForRemoval,
	NAME_AUTO_APPLY_THRESHOLD,
	NAME_SIMILARITY_THRESHOLD,
	type NameOnlyCandidate,
	namesAreClose,
	normalizeName,
	splitStoredName,
} from "./person-matching.ts";

describe("normalizeName", () => {
	it("trims, lowercases, and collapses internal whitespace", () => {
		expect(normalizeName("  Ada   Lovelace \n")).toBe("ada lovelace");
	});

	it("strips punctuation", () => {
		expect(normalizeName("O'Brien-Smith, Jr.")).toBe("obriensmith jr");
	});
});

describe("splitStoredName", () => {
	it("treats the last word as the surname", () => {
		expect(splitStoredName("Blessing Kodze")).toEqual({
			firstName: "Blessing",
			surname: "Kodze",
		});
	});

	it("folds a multi-word first name into everything before the last word", () => {
		expect(splitStoredName("Mary Jane Watson")).toEqual({
			firstName: "Mary Jane",
			surname: "Watson",
		});
	});

	it("treats a single-word name as first name only, with no surname", () => {
		expect(splitStoredName("Cher")).toEqual({ firstName: "Cher", surname: "" });
	});

	it("collapses extra whitespace before splitting", () => {
		expect(splitStoredName("  Ada   Lovelace  ")).toEqual({
			firstName: "Ada",
			surname: "Lovelace",
		});
	});
});

describe("namesAreClose", () => {
	it("is true for an exact match", () => {
		expect(namesAreClose("Ada", "Ada")).toBe(true);
	});

	it("is true for case- and whitespace-only differences — not a typo", () => {
		expect(namesAreClose("ADA  LOVELACE", "ada lovelace")).toBe(true);
	});

	it("is true for a one-letter typo", () => {
		expect(namesAreClose("Blessing", "Blesing")).toBe(true);
	});

	it("is false for two unrelated names", () => {
		expect(namesAreClose("Ada", "Zephyrine")).toBe(false);
	});

	it("is false against an empty name", () => {
		expect(namesAreClose("Ada", "")).toBe(false);
		expect(namesAreClose("", "Ada")).toBe(false);
	});

	it("is true for two empty names — nobody has a surname, which is a match, not a difference", () => {
		expect(namesAreClose("", "")).toBe(true);
	});

	// Same-length strings differing only by substitution: Levenshtein distance
	// equals the substitution count exactly, so similarity = 1 - k/length is
	// exact — this pins down NAME_SIMILARITY_THRESHOLD's actual behavior
	// rather than trusting the constant without proof.
	it("sits right at the documented threshold", () => {
		expect(NAME_SIMILARITY_THRESHOLD).toBe(0.82);
	});

	function withSubstitutions(base: string, count: number): string {
		const chars = base.split("");
		for (let i = 0; i < count; i++) chars[i] = "z";
		return chars.join("");
	}

	it("is true just at/above the similarity threshold", () => {
		const base = "a".repeat(50);
		// 9 substitutions on 50 chars: similarity = 1 - 9/50 = 0.82, exactly at threshold.
		const atThreshold = withSubstitutions(base, 9);
		expect(namesAreClose(base, atThreshold)).toBe(true);
	});

	it("is false just below the similarity threshold", () => {
		const base = "a".repeat(50);
		// 10 substitutions on 50 chars: similarity = 1 - 10/50 = 0.80, below threshold.
		const belowThreshold = withSubstitutions(base, 10);
		expect(namesAreClose(base, belowThreshold)).toBe(false);
	});
});

describe("matchPerson", () => {
	const ada: MatchCandidatePerson = {
		id: "ada-1",
		name: "Ada Lovelace",
		email: "ada@example.com",
		phone: "0700000001",
	};
	const grace: MatchCandidatePerson = {
		id: "grace-1",
		name: "Grace Hopper",
		email: "grace@example.com",
		phone: "0700000002",
	};
	// Longer, more realistic names for the typo-tolerance tests — "Ada" is only
	// 3 letters, so even one inserted/substituted character drops similarity
	// well below the threshold no matter how tight or loose it's set; that's
	// a property of short strings under a percentage-based threshold, not
	// something to fix by loosening the threshold itself.
	const precious: MatchCandidatePerson = {
		id: "precious-1",
		name: "Precious Ndlovu",
		email: "precious@example.com",
		phone: "0700000003",
	};
	const anotherPrecious: MatchCandidatePerson = {
		id: "precious-2",
		name: "Precious Ndlovu",
		email: null,
		phone: null,
	};

	const payload = (
		overrides: Partial<Parameters<typeof matchPerson>[0]> = {},
	) => ({
		firstName: "Ada",
		surname: "Lovelace",
		email: "ada@example.com",
		phone: null,
		...overrides,
	});

	it("exact email match, exact name -> CONFIDENT_UPDATE", () => {
		expect(matchPerson(payload(), [ada, grace])).toEqual({
			outcome: "CONFIDENT_UPDATE",
			personId: "ada-1",
		});
	});

	it("exact email match, one-letter typo in first name -> CONFIDENT_UPDATE", () => {
		const result = matchPerson(
			{
				firstName: "Precius", // dropped the "o"
				surname: "Ndlovu",
				email: "precious@example.com",
				phone: null,
			},
			[precious, grace],
		);
		expect(result).toEqual({
			outcome: "CONFIDENT_UPDATE",
			personId: "precious-1",
		});
	});

	it("email matches case-insensitively too", () => {
		const result = matchPerson(payload({ email: "ADA@EXAMPLE.COM" }), [ada]);
		expect(result).toEqual({ outcome: "CONFIDENT_UPDATE", personId: "ada-1" });
	});

	it("exact email match, but the name is a completely different person's -> NEEDS_REVIEW", () => {
		const result = matchPerson(
			payload({ firstName: "Grace", surname: "Hopper" }),
			[ada],
		);
		expect(result.outcome).toBe("NEEDS_REVIEW");
		if (result.outcome === "NEEDS_REVIEW") {
			expect(result.candidates).toEqual([
				{
					personId: "ada-1",
					matchReason: "email matches but name differs substantially",
				},
			]);
		}
	});

	it("no email or phone, name unrelated to anyone -> CONFIDENT_CREATE", () => {
		const result = matchPerson(
			payload({ email: null, firstName: "Zephyrine", surname: "Quantock" }),
			[ada, grace],
		);
		expect(result).toEqual({ outcome: "CONFIDENT_CREATE" });
	});

	it("no email, phone matches one person, name also matches -> CONFIDENT_UPDATE", () => {
		const result = matchPerson(payload({ email: null, phone: "0700000001" }), [
			ada,
			grace,
		]);
		expect(result).toEqual({ outcome: "CONFIDENT_UPDATE", personId: "ada-1" });
	});

	it("no email, phone matches one person, name doesn't -> NEEDS_REVIEW", () => {
		const result = matchPerson(
			payload({
				email: null,
				phone: "0700000001",
				firstName: "Grace",
				surname: "Hopper",
			}),
			[ada, grace],
		);
		expect(result.outcome).toBe("NEEDS_REVIEW");
		if (result.outcome === "NEEDS_REVIEW") {
			expect(result.candidates).toEqual([
				{
					personId: "ada-1",
					matchReason: "phone matches someone whose name doesn't match",
				},
			]);
		}
	});

	it("first name matches exactly, surname completely different -> CONFIDENT_CREATE, not a match", () => {
		const result = matchPerson(
			payload({ email: null, firstName: "Ada", surname: "Zephyrine" }),
			[ada],
		);
		expect(result).toEqual({ outcome: "CONFIDENT_CREATE" });
	});

	it("both first name and surname close (one typo each), no email/phone, only one candidate -> CONFIDENT_UPDATE", () => {
		const result = matchPerson(
			{
				firstName: "Precius", // dropped the "o"
				surname: "Ndlov", // dropped the "u"
				email: null,
				phone: null,
			},
			[precious, grace],
		);
		expect(result).toEqual({
			outcome: "CONFIDENT_UPDATE",
			personId: "precious-1",
		});
	});

	it("the same fuzzy scenario matching two different people -> NEEDS_REVIEW listing both", () => {
		const result = matchPerson(
			{
				firstName: "Precius",
				surname: "Ndlov",
				email: null,
				phone: null,
			},
			[precious, anotherPrecious, grace],
		);
		expect(result.outcome).toBe("NEEDS_REVIEW");
		if (result.outcome === "NEEDS_REVIEW") {
			expect(result.candidates.map((c) => c.personId).sort()).toEqual([
				"precious-1",
				"precious-2",
			]);
		}
	});

	it("email matches two different people -> NEEDS_REVIEW listing both", () => {
		const dupe: MatchCandidatePerson = {
			...grace,
			id: "grace-2",
			email: "ada@example.com",
		};
		const result = matchPerson(payload(), [ada, dupe]);
		expect(result.outcome).toBe("NEEDS_REVIEW");
		if (result.outcome === "NEEDS_REVIEW") {
			expect(result.candidates.map((c) => c.personId).sort()).toEqual([
				"ada-1",
				"grace-2",
			]);
			expect(
				result.candidates.every(
					(c) => c.matchReason === "email matches more than one person on file",
				),
			).toBe(true);
		}
	});

	it("phone matches two different people -> NEEDS_REVIEW listing both", () => {
		const dupe: MatchCandidatePerson = {
			...grace,
			id: "grace-2",
			phone: "0700000001",
		};
		const result = matchPerson(payload({ email: null, phone: "0700000001" }), [
			ada,
			dupe,
		]);
		expect(result.outcome).toBe("NEEDS_REVIEW");
		if (result.outcome === "NEEDS_REVIEW") {
			expect(result.candidates.map((c) => c.personId).sort()).toEqual([
				"ada-1",
				"grace-2",
			]);
		}
	});

	it("email and phone point to two different people -> NEEDS_REVIEW naming both", () => {
		const result = matchPerson(
			payload({ email: "ada@example.com", phone: "0700000002" }),
			[ada, grace],
		);
		expect(result.outcome).toBe("NEEDS_REVIEW");
		if (result.outcome === "NEEDS_REVIEW") {
			expect(result.candidates.map((c) => c.personId).sort()).toEqual([
				"ada-1",
				"grace-1",
			]);
		}
	});

	it("a name match alone, above the auto-apply threshold, with only one candidate -> CONFIDENT_UPDATE", () => {
		// Exact name match, but no email or phone at all.
		const result = matchPerson(payload({ email: null, phone: null }), [ada]);
		expect(result).toEqual({ outcome: "CONFIDENT_UPDATE", personId: "ada-1" });
	});

	it("a name match alone, below the auto-apply threshold -> CONFIDENT_CREATE, not a match", () => {
		const result = matchPerson(
			payload({
				email: null,
				phone: null,
				firstName: "Ada",
				surname: "Zzzzzzzz",
			}),
			[ada],
		);
		expect(result).toEqual({ outcome: "CONFIDENT_CREATE" });
	});

	it("a name match alone, above the auto-apply threshold but matching two people -> NEEDS_REVIEW", () => {
		const result = matchPerson(payload({ email: null, phone: null }), [
			ada,
			{ ...ada, id: "ada-2" },
		]);
		expect(result.outcome).toBe("NEEDS_REVIEW");
		if (result.outcome === "NEEDS_REVIEW") {
			expect(result.candidates.map((c) => c.personId).sort()).toEqual([
				"ada-1",
				"ada-2",
			]);
		}
	});

	it("sits right at the documented auto-apply threshold", () => {
		expect(NAME_AUTO_APPLY_THRESHOLD).toBe(0.7);
	});

	it("a single candidate just at the auto-apply threshold, below the review-flag threshold -> CONFIDENT_UPDATE", () => {
		// Same-length strings differing only by substitution, so similarity is
		// exact: 15 substitutions on 50 chars -> 1 - 15/50 = 0.70, exactly at
		// NAME_AUTO_APPLY_THRESHOLD and comfortably below NAME_SIMILARITY_THRESHOLD
		// (0.82) — proving this tier is reachable at a similarity that used to
		// fall through to CONFIDENT_CREATE entirely.
		const base = "a".repeat(50);
		const chars = base.split("");
		for (let i = 0; i < 15; i++) chars[i] = "z";
		const atThreshold = chars.join("");

		const candidate: MatchCandidatePerson = {
			id: "candidate-1",
			name: `${base} ${base}`,
			email: null,
			phone: null,
		};
		const result = matchPerson(
			{
				firstName: atThreshold,
				surname: atThreshold,
				email: null,
				phone: null,
			},
			[candidate],
		);
		expect(result).toEqual({
			outcome: "CONFIDENT_UPDATE",
			personId: "candidate-1",
		});
	});

	it("case/whitespace-only name differences count as a match, not a typo", () => {
		const result = matchPerson(
			payload({ firstName: "ADA", surname: "  lovelace" }),
			[ada],
		);
		expect(result).toEqual({ outcome: "CONFIDENT_UPDATE", personId: "ada-1" });
	});

	describe("regression: fixes for the old matching logic's known failures", () => {
		it("a differently-cased email, which the old exact eq() match missed, now matches", () => {
			// The old logic compared emails with a raw SQL equality (case-sensitive
			// in Postgres), so "Ada@Example.com" would never have matched a stored
			// "ada@example.com" and would have silently created a duplicate.
			const result = matchPerson(payload({ email: "Ada@Example.Com" }), [ada]);
			expect(result).toEqual({
				outcome: "CONFIDENT_UPDATE",
				personId: "ada-1",
			});
		});

		it("a one-letter typo'd name with no email, which the old logic silently created as a duplicate, now matches the existing person instead", () => {
			// The old findFullNameMatches did an exact (post-normalize) string
			// comparison with no fuzzy tolerance at all — zero matches meant a new
			// member was created immediately, with no human ever seeing that a
			// near-identical name already existed. A single fuzzy match above the
			// auto-apply threshold now resolves to that person directly.
			const result = matchPerson(
				{ firstName: "Precius", surname: "Ndlovu", email: null, phone: null },
				[precious],
			);
			expect(result).toEqual({
				outcome: "CONFIDENT_UPDATE",
				personId: "precious-1",
			});
		});
	});
});

describe("matchPersonForRemoval", () => {
	const ada: NameOnlyCandidate = { id: "ada-1", name: "Ada Lovelace" };
	const grace: NameOnlyCandidate = { id: "grace-1", name: "Grace Hopper" };
	const anotherAda: NameOnlyCandidate = { id: "ada-2", name: "Ada Lovelace" };
	const precious: NameOnlyCandidate = {
		id: "precious-1",
		name: "Precious Ndlovu",
	};

	it("exact match to exactly one person -> EXACT_MATCH", () => {
		expect(
			matchPersonForRemoval({ firstName: "Ada", surname: "Lovelace" }, [
				ada,
				grace,
			]),
		).toEqual({ outcome: "EXACT_MATCH", personId: "ada-1" });
	});

	it("matches case- and whitespace-only differences as exact, not fuzzy", () => {
		expect(
			matchPersonForRemoval({ firstName: "ADA", surname: "  lovelace" }, [ada]),
		).toEqual({ outcome: "EXACT_MATCH", personId: "ada-1" });
	});

	it("exact match to several people -> NEEDS_REVIEW listing all of them", () => {
		const result = matchPersonForRemoval(
			{ firstName: "Ada", surname: "Lovelace" },
			[ada, anotherAda, grace],
		);
		expect(result.outcome).toBe("NEEDS_REVIEW");
		if (result.outcome === "NEEDS_REVIEW") {
			expect(result.candidates.map((c) => c.personId).sort()).toEqual([
				"ada-1",
				"ada-2",
			]);
			expect(
				result.candidates.every(
					(c) => c.matchReason === "name matches more than one person on file",
				),
			).toBe(true);
		}
	});

	it("a close-but-not-exact name (typo) never auto-executes — NEEDS_REVIEW instead", () => {
		// Unlike matchPerson's intake path, removal has no email/phone to
		// corroborate a fuzzy match, and the consequence of guessing wrong
		// (soft-deleting an innocent person) is worse — so even a single fuzzy
		// candidate still goes to a human.
		const result = matchPersonForRemoval(
			{ firstName: "Precius", surname: "Ndlovu" },
			[precious],
		);
		expect(result.outcome).toBe("NEEDS_REVIEW");
		if (result.outcome === "NEEDS_REVIEW") {
			expect(result.candidates).toEqual([
				{
					personId: "precious-1",
					matchReason: "name is a close match, but not exact",
				},
			]);
		}
	});

	it("no match at all, not even fuzzy -> NEEDS_REVIEW with no candidates", () => {
		const result = matchPersonForRemoval(
			{ firstName: "Zephyrine", surname: "Quantock" },
			[ada, grace],
		);
		expect(result).toEqual({ outcome: "NEEDS_REVIEW", candidates: [] });
	});

	it("does not confuse a first/surname swap for a match", () => {
		const result = matchPersonForRemoval(
			{ firstName: "Lovelace", surname: "Ada" },
			[ada],
		);
		expect(result).toEqual({ outcome: "NEEDS_REVIEW", candidates: [] });
	});
});
