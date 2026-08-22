/**
 * Alphabet for generated passwords. Deliberately excludes characters that are
 * easy to confuse when a password is read aloud or copied by hand — 0/O, 1/l/I —
 * because these are handed to a new user out-of-band.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

const DEFAULT_LENGTH = 16;

/**
 * Cryptographically random temporary password.
 *
 * Rejection sampling keeps the distribution uniform: taking `byte % length`
 * directly would bias toward the front of the alphabet, since 256 is not a
 * multiple of the alphabet size.
 */
export function generateTemporaryPassword(length = DEFAULT_LENGTH): string {
	const limit = 256 - (256 % ALPHABET.length);
	let out = "";

	while (out.length < length) {
		const bytes = new Uint8Array(length);
		crypto.getRandomValues(bytes);

		for (const byte of bytes) {
			if (byte >= limit) continue;
			out += ALPHABET[byte % ALPHABET.length];
			if (out.length === length) break;
		}
	}

	return out;
}
