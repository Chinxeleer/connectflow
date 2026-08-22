/**
 * A small RFC 4180 CSV reader.
 *
 * Hand-rolled rather than adding a dependency: the import accepts one
 * spreadsheet export, and the cases that actually matter are quoted fields
 * containing commas, escaped double quotes, and CRLF line endings.
 */
export function parseCsv(input: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;

	// Strip a UTF-8 BOM; Excel exports one and it corrupts the first header.
	const text = input.replace(/^﻿/, "");

	for (let i = 0; i < text.length; i++) {
		const char = text[i];

		if (inQuotes) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
		} else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && text[i + 1] === "\n") i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += char;
		}
	}

	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	// Drop rows that are entirely blank — trailing newlines and spacer rows.
	return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

/**
 * Header aliases. The source sheet is a human-maintained export, so the same
 * column shows up under several spellings; anything unrecognised is ignored
 * rather than guessed at.
 */
const HEADER_ALIASES: Record<string, ReadonlyArray<string>> = {
	// `name` is matched first, so "connect members" binds to the member column
	// rather than to the leader column's "connect" alias.
	name: [
		"name",
		"member",
		"members",
		"member name",
		"connect member",
		"connect members",
		"full name",
		"fullname",
		"name and surname",
	],
	leaderLabel: [
		"leader",
		"connect leader",
		"connect",
		"group",
		"group leader",
		"cell leader",
		"name and surname of leader",
		"name of leader",
		"surname of leader",
		"leader name",
	],
	phone: ["phone", "phone number", "contact", "mobile", "tel", "whatsapp"],
	email: ["email", "email address", "e-mail"],
	gender: ["gender", "sex"],
	residence: ["residence", "location", "area", "hall", "hostel", "address"],
	fieldOfStudy: [
		"field of study",
		"field",
		"course",
		"programme",
		"program",
		"study",
		"department",
	],
	status: ["status", "state"],
};

export type HeaderMap = Partial<Record<keyof typeof HEADER_ALIASES, number>>;

function normaliseHeader(value: string): string {
	return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Maps each known field to its column index, by header name. */
export function mapHeaders(headerRow: ReadonlyArray<string>): HeaderMap {
	const map: HeaderMap = {};

	headerRow.forEach((raw, index) => {
		const header = normaliseHeader(raw);

		for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
			if (map[field as keyof HeaderMap] !== undefined) continue;
			if (aliases.includes(header)) {
				map[field as keyof HeaderMap] = index;
				return;
			}
		}
	});

	return map;
}

export function cellAt(
	row: ReadonlyArray<string>,
	index: number | undefined,
): string {
	if (index === undefined) return "";
	return row[index] ?? "";
}
