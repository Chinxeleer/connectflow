export { handleMemberRemovalWebhook } from "./action.ts";
export { findNameMatches, type NameCandidate, normalizeName } from "./match.ts";
export {
	insertPendingRemoval,
	selectRemovalCandidates,
	softDeleteMember,
} from "./query.ts";
export {
	type MemberRemovalValues,
	type MemberRemovalWebhookInput,
	memberRemovalSchema,
	memberRemovalWebhookSchema,
} from "./schema.ts";
