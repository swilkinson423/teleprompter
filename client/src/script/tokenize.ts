export type Token = { display: string; normalized: string };
export type ScriptSentence = { tokens: Token[]; paragraphIndex: number };
export type FlatToken = { sentenceIdx: number; wordIdx: number; normalized: string };

export function normalize(word: string): string {
	return word.toLowerCase().replace(/[^a-z0-9']/g, "");
}

export function tokenizeSentence(text: string): Token[] {
	return text
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => ({ display: w, normalized: normalize(w) }))
		.filter((t) => t.normalized.length > 0);
}

export function flattenScript(sentences: ScriptSentence[]): FlatToken[] {
	const flat: FlatToken[] = [];
	sentences.forEach((s, si) => {
		s.tokens.forEach((t, wi) => {
			flat.push({ sentenceIdx: si, wordIdx: wi, normalized: t.normalized });
		});
	});
	return flat;
}
