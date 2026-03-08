import { normalize, type FlatToken } from "./tokenize";

const QUERY_LEN = 6;
const WINDOW_BACK = 20;
const WINDOW_FORWARD = 80;

// Minimum matches (across all words) to even consider a position
const MIN_TOTAL_MATCH = 2;
// Minimum composite score to accept an update
const MIN_SCORE = 1.5;
// Content words score 3x more than stopwords
const CONTENT_WEIGHT = 3;
// Penalise distance from the "ideal" advance of ~2 tokens per turn
const DISTANCE_PENALTY = 0.15;
const TARGET_ADVANCE = 2;

// Common function words that appear everywhere and are poor position discriminators
const STOPWORDS = new Set([
	"a", "an", "the", "and", "or", "but",
	"is", "are", "was", "were", "be", "been", "being",
	"have", "has", "had", "do", "does", "did",
	"will", "would", "could", "should", "may", "might", "can",
	"to", "of", "in", "on", "at", "by", "for", "with", "as",
	"it", "its", "this", "that", "these", "those",
	"i", "you", "he", "she", "we", "they",
	"not", "so", "if", "up", "what", "which", "who",
]);

/**
 * Given the flat script token list, the current position (flat index),
 * and the latest transcript words, returns the updated flat position.
 */
export function alignTranscript(
	flat: FlatToken[],
	currentPos: number,
	transcriptWords: string[]
): number {
	if (flat.length === 0) return currentPos;

	const query = transcriptWords
		.map(normalize)
		.filter((w) => w.length > 0)
		.slice(-QUERY_LEN);

	// Never move on fewer than 2 words — single common words cause false positives
	if (query.length < 2) return currentPos;

	const searchStart = Math.max(0, currentPos - WINDOW_BACK);
	const searchEnd = Math.min(flat.length - query.length, currentPos + WINDOW_FORWARD);

	let bestScore = -Infinity;
	let bestPos = currentPos;
	let bestContentMatch = 0;

	for (let i = searchStart; i <= searchEnd; i++) {
		let totalMatch = 0;
		let contentMatch = 0;
		for (let j = 0; j < query.length; j++) {
			if (flat[i + j]?.normalized === query[j]) {
				totalMatch++;
				if (!STOPWORDS.has(query[j])) contentMatch++;
			}
		}

		// Skip positions that don't meet the minimum total match
		if (totalMatch < MIN_TOTAL_MATCH) continue;

		const endPos = i + query.length - 1;
		const jump = endPos - currentPos;

		// Score: content matches count more; penalise distance from ideal advance
		const score =
			contentMatch * CONTENT_WEIGHT +
			totalMatch -
			Math.abs(jump - TARGET_ADVANCE) * DISTANCE_PENALTY;

		if (score > bestScore) {
			bestScore = score;
			bestPos = endPos;
			bestContentMatch = contentMatch;
		}
	}

	// Reject if no sufficiently confident match was found
	if (bestScore < MIN_SCORE) return currentPos;

	const jump = bestPos - currentPos;

	// Extra guards: large forward jumps need content word evidence
	if (jump > 20 && bestContentMatch < 1) return currentPos;
	if (jump > 40 && bestContentMatch < 2) return currentPos;

	// Rewinds need strong evidence to avoid false restarts
	if (jump < -5 && bestContentMatch < 2) return currentPos;

	return bestPos;
}