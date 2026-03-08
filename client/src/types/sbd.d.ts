declare module 'sbd' {
	interface SentenceTokenizerOptions {
		newline_boundaries?: boolean;
		html_boundaries?: boolean;
		sanitize?: boolean;
		allowed_tags?: string[];
		abbreviations?: string[];
	}

	export function sentences(
		text: string,
		options?: SentenceTokenizerOptions
	): string[];
}