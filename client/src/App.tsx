import { useEffect, useMemo, useRef, useState } from "react";
import sbd from "sbd";
import { useStreamingStt } from "./stt/useStreamingStt";
import { startMicPcm16k } from "./audio/micPcmWorklet";
import { tokenizeSentence, flattenScript, type ScriptSentence } from "./script/tokenize";
import { alignTranscript } from "./script/align";

type AppState = "idle" | "starting" | "running" | "paused" | "finished" | "error";
type Theme = "dark" | "light";

const SAMPLE_SCRIPT =
	"Welcome to the teleprompter prototype. This first sentence will be highlighted as you speak.\n\n" +
	"This is the second paragraph. Each word lights up as you read it aloud. " +
	"Try reading at a natural pace and watch the highlighting follow along.";

function hexToRgba(hex: string, alpha: number): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `rgba(${r},${g},${b},${alpha})`;
}

export default function App() {
	const [text, setText] = useState(SAMPLE_SCRIPT);
	const [appState, setAppState] = useState<AppState>("idle");
	const [error, setError] = useState<string | null>(null);
	const [currentPos, setCurrentPos] = useState(-1);
	const [fontSize, setFontSize] = useState(26);
	const [theme, setTheme] = useState<Theme>("dark");
	const [highlightColor, setHighlightColor] = useState("#ffe066");
	const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
	const [selectedMicId, setSelectedMicId] = useState("");

	const appStateRef = useRef<AppState>("idle");
	const stopMicRef = useRef<(() => void) | null>(null);
	const activeSentenceRef = useRef<HTMLDivElement | null>(null);
	const scrollerRef = useRef<HTMLDivElement | null>(null);

	const { connect, disconnect, sendAudioChunk, lastTurn, status } = useStreamingStt();

	const isDark = theme === "dark";

	function transitionTo(state: AppState) {
		appStateRef.current = state;
		setAppState(state);
	}

	// Apply body background when theme changes
	useEffect(() => {
		document.body.style.background = isDark ? "#0a0a0a" : "#f0f0f0";
		document.body.style.margin = "0";
	}, [isDark]);

	// Enumerate microphones; re-run after permission is granted (labels appear then)
	async function enumerateMics() {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			const inputs = devices.filter((d) => d.kind === "audioinput");
			setMicDevices(inputs);
			if (inputs.length > 0 && !selectedMicId) setSelectedMicId(inputs[0].deviceId);
		} catch {}
	}
	useEffect(() => { enumerateMics(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

	// ── Script parsing ───────────────────────────────────────────────────────

	const sentences: ScriptSentence[] = useMemo(() => {
		const paragraphs = text.split(/\n\s*\n+/g);
		return paragraphs.flatMap((p, pi) =>
			sbd.sentences(p, { newline_boundaries: false }).map((s: string) => ({
				tokens: tokenizeSentence(s),
				paragraphIndex: pi,
			}))
		);
	}, [text]);

	const flat = useMemo(() => flattenScript(sentences), [sentences]);

	const flatIndexMap = useMemo(() => {
		const map: number[][] = sentences.map((s) => new Array(s.tokens.length).fill(-1));
		flat.forEach((ft, i) => { map[ft.sentenceIdx][ft.wordIdx] = i; });
		return map;
	}, [flat, sentences]);

	// ── Effects ──────────────────────────────────────────────────────────────

	useEffect(() => { setCurrentPos(-1); }, [flat]);

	useEffect(() => {
		const words = lastTurn?.words?.length
			? lastTurn.words.map((w) => w.text)
			: lastTurn?.transcript?.split(/ +/).filter(Boolean) ?? [];
		if (words.length === 0) return;
		setCurrentPos((prev) => alignTranscript(flat, Math.max(prev, 0), words));
	}, [lastTurn, flat]);

	useEffect(() => {
		activeSentenceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, [currentPos]);

	useEffect(() => {
		if (appStateRef.current === "running" && flat.length > 0 && currentPos >= flat.length - 1) {
			handleFinished();
		}
	}, [currentPos, flat.length]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (status === "error" && appStateRef.current === "running") {
			handleError("Connection to speech service lost. Check that the server is running.");
		}
	}, [status]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.target instanceof HTMLTextAreaElement) return;
			if (e.code === "Space") {
				e.preventDefault();
				const s = appStateRef.current;
				if (s === "idle" || s === "finished" || s === "error") handleStart();
				else if (s === "running") handlePause();
				else if (s === "paused") handleResume();
			} else if (e.code === "Escape") {
				const s = appStateRef.current;
				if (s === "running" || s === "paused") handleStop();
			}
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// ── Session control ──────────────────────────────────────────────────────

	async function handleStart() {
		setError(null);
		setCurrentPos(-1);
		scrollerRef.current?.scrollTo({ top: 0 });
		transitionTo("starting");
		try {
			const stopMic = await startMicPcm16k(sendAudioChunk, selectedMicId || undefined);
			stopMicRef.current = stopMic;
			await enumerateMics(); // refresh labels now that permission is granted
			connect();
			transitionTo("running");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Microphone access denied.");
			transitionTo("error");
		}
	}

	async function handleResume() {
		transitionTo("starting");
		try {
			const stopMic = await startMicPcm16k(sendAudioChunk, selectedMicId || undefined);
			stopMicRef.current = stopMic;
			connect();
			transitionTo("running");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not resume microphone.");
			transitionTo("error");
		}
	}

	function handlePause() {
		transitionTo("paused");
		stopMicRef.current?.();
		stopMicRef.current = null;
		disconnect();
	}

	function handleStop() {
		transitionTo("idle");
		stopMicRef.current?.();
		stopMicRef.current = null;
		disconnect();
		setCurrentPos(-1);
		scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
	}

	function handleFinished() {
		transitionTo("finished");
		stopMicRef.current?.();
		stopMicRef.current = null;
		disconnect();
	}

	function handleError(msg: string) {
		transitionTo("error");
		setError(msg);
		stopMicRef.current?.();
		stopMicRef.current = null;
		disconnect();
	}

	// ── Derived values ───────────────────────────────────────────────────────

	const activeSentenceIdx = currentPos >= 0 ? (flat[currentPos + 1]?.sentenceIdx ?? flat[currentPos]?.sentenceIdx ?? -1) : 0;
	const progressPct =
		flat.length > 0 && currentPos >= 0
			? Math.min(100, Math.round(((currentPos + 1) / flat.length) * 100))
			: 0;
	const isActive = appState === "running" || appState === "paused";

	// Theme-derived colours
	const c = {
		appBg:          isDark ? "#0a0a0a"   : "#f0f0f0",
		appColor:       isDark ? "#eee"      : "#222",
		displayBg:      isDark ? "#111"      : "#fafafa",
		displayBorder:  isDark ? "#2a2a2a"   : "#ddd",
		wordDone:       isDark ? "#333"      : "#ccc",
		wordNext:       isDark ? "#fff"      : "#111",
		wordUpcoming:   isDark ? "#888"      : "#555",
		sentenceHl:     hexToRgba(highlightColor, isDark ? 0.22 : 0.28),
		progressBg:     isDark ? "#222"      : "#ddd",
		textareaBg:     isDark ? "#1a1a1a"   : "#fff",
		textareaLocked: isDark ? "#141414"   : "#f5f5f5",
		textareaColor:  isDark ? "#eee"      : "#111",
		textareaLocked2:isDark ? "#555"      : "#999",
		border:         isDark ? "#333"      : "#ccc",
		labelColor:     isDark ? "#777"      : "#888",
		hintColor:      isDark ? "#444"      : "#aaa",
		errorColor:     isDark ? "#e66"      : "#c33",
		inputBg:        isDark ? "#2a2a2a"   : "#fff",
		inputColor:     isDark ? "#eee"      : "#222",
		inputBorder:    isDark ? "#555"      : "#bbb",
	};

	// ── Render ───────────────────────────────────────────────────────────────

	return (
		<div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 16px 32px", fontFamily: "system-ui", color: c.appColor, background: c.appBg, minHeight: "100vh" }}>
			<style>{`
				* { box-sizing: border-box; }
				button {
					cursor: pointer; padding: 6px 16px; border-radius: 6px;
					border: 1px solid ${c.inputBorder};
					background: ${c.inputBg}; color: ${c.inputColor};
					font-size: 14px; font-family: system-ui;
				}
				button:hover:not(:disabled) { filter: brightness(1.2); }
				button:disabled { opacity: 0.45; cursor: default; }
				button.primary { background: #1a6b3a; border-color: #1a6b3a; color: #fff; }
				button.primary:hover:not(:disabled) { background: #1f8047; }
				button.danger  { background: #6b1a1a; border-color: #6b1a1a; color: #fff; }
				button.danger:hover:not(:disabled)  { background: #801f1f; }
				select {
					cursor: pointer; padding: 5px 8px; border-radius: 6px;
					border: 1px solid ${c.inputBorder};
					background: ${c.inputBg}; color: ${c.inputColor};
					font-size: 13px; font-family: system-ui;
				}
				@keyframes recpulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
			`}</style>

			{/* Header */}
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
				<h2 style={{ margin: 0 }}>Teleprompter</h2>
				<button onClick={() => setTheme(isDark ? "light" : "dark")} style={{ fontSize: 13, padding: "4px 12px" }}>
					{isDark ? "☀ Light mode" : "🌙 Dark mode"}
				</button>
			</div>

			{/* ── Teleprompter display ── */}
			<div
				ref={scrollerRef}
				style={{
					border: `1px solid ${c.displayBorder}`, borderRadius: 8,
					padding: "48px 32px", height: 420,
					overflowY: "auto", overflowX: "hidden",
					background: c.displayBg, color: c.wordUpcoming,
					fontSize, lineHeight: 1.9,
					marginBottom: 8,
				}}
			>
				{appState === "finished" && (
					<div style={{ textAlign: "center", color: "#4a4", marginBottom: 32, fontSize: 18 }}>
						✓ Script complete
					</div>
				)}

				{sentences.map((sentence, si) => {
					const isNewParagraph = si > 0 && sentences[si - 1].paragraphIndex !== sentence.paragraphIndex;
					const isSentenceActive = si === activeSentenceIdx;
					return (
						<div
							key={si}
							ref={isSentenceActive ? activeSentenceRef : undefined}
							style={{
						marginTop: isNewParagraph ? 28 : 4,
						borderRadius: 4,
						background: "transparent",
						transition: "background 0.3s",
						display: "flex",
						flexWrap: "wrap",
						columnGap: "0.3em",
						alignItems: "baseline",
					}}
						>
							{sentence.tokens.map((token, wi) => {
								const flatIdx = flatIndexMap[si]?.[wi] ?? -1;
								const state =
						si < activeSentenceIdx      ? "done"     :
						si > activeSentenceIdx      ? "default"  :
						flatIdx <= currentPos       ? "done"     :
						flatIdx <= currentPos + 3   ? "active"   : "sentence";
								return (
									<span
										key={wi}
										style={{
											color:
							state === "done"    ? c.wordDone :
							state === "default" ? c.appColor :
							highlightColor,
											fontWeight: state === "active" ? "bold" : "normal",
											transition: "color 0.1s",
										}}
									>
										{token.display}
									</span>
								);
							})}
						</div>
					);
				})}
			</div>

			{/* Progress bar */}
			{(isActive || appState === "finished") && (
				<div style={{ marginBottom: 10 }}>
					<div style={{ height: 3, background: c.progressBg, borderRadius: 2, overflow: "hidden" }}>
						<div style={{ height: "100%", width: `${progressPct}%`, background: highlightColor, transition: "width 0.3s" }} />
					</div>
					<div style={{ color: c.labelColor, fontSize: 12, marginTop: 3 }}>
						Sentence {Math.min(activeSentenceIdx + 1, sentences.length)} of {sentences.length}
						{" · "}{progressPct}%
					</div>
				</div>
			)}

			{/* Primary controls */}
			<div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
				{(appState === "idle" || appState === "error") && (
					<button className="primary" onClick={handleStart}>▶ Start</button>
				)}
				{appState === "starting" && <button disabled>● Connecting…</button>}
				{appState === "running" && (<>
					<button onClick={handlePause}>⏸ Pause</button>
					<button className="danger" onClick={handleStop}>■ Stop</button>
				</>)}
				{appState === "paused" && (<>
					<button className="primary" onClick={handleResume}>▶ Resume</button>
					<button className="danger" onClick={handleStop}>■ Stop</button>
				</>)}
				{appState === "finished" && (
					<button className="primary" onClick={handleStart}>↺ Start Over</button>
				)}

				{appState === "running" && (
					<span style={{ display: "flex", alignItems: "center", gap: 6, color: "#e55", fontSize: 13 }}>
						<span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e55", display: "inline-block", animation: "recpulse 1.2s ease-in-out infinite" }} />
						Recording
					</span>
				)}
				{appState === "paused"   && <span style={{ color: c.labelColor, fontSize: 13 }}>Paused — position held</span>}
				{appState === "finished" && <span style={{ color: "#4a4", fontSize: 14 }}>✓ Finished</span>}
			</div>

			{/* Settings row */}
			<div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
				{/* Font size */}
				<div style={{ display: "flex", alignItems: "center", gap: 6, color: c.labelColor, fontSize: 13 }}>
					<span style={{ fontSize: 12 }}>A</span>
					<input type="range" min={16} max={40} step={2} value={fontSize}
						onChange={(e) => setFontSize(Number(e.target.value))}
						style={{ width: 80 }} />
					<span style={{ fontSize: 18 }}>A</span>
				</div>

				<div style={{ width: 1, height: 18, background: c.border }} />

				{/* Highlight colour */}
				<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: c.labelColor, fontSize: 13 }}>
					Highlight
					<input type="color" value={highlightColor}
						onChange={(e) => setHighlightColor(e.target.value)}
						style={{ width: 32, height: 24, border: `1px solid ${c.inputBorder}`, borderRadius: 4, padding: 2, cursor: "pointer", background: c.inputBg }} />
				</label>

				<div style={{ width: 1, height: 18, background: c.border }} />

				{/* Microphone */}
				<label style={{ display: "flex", alignItems: "center", gap: 6, color: c.labelColor, fontSize: 13 }}>
					🎤
					<select value={selectedMicId} onChange={(e) => setSelectedMicId(e.target.value)} disabled={isActive}>
						{micDevices.length === 0
							? <option value="">Default microphone</option>
							: micDevices.map((d) => (
								<option key={d.deviceId} value={d.deviceId}>
									{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
								</option>
							))
						}
					</select>
				</label>
			</div>

			{/* Error / hint */}
			{appState === "error" && error && (
				<div style={{ color: c.errorColor, fontSize: 13, marginBottom: 8 }}>⚠ {error}</div>
			)}
			{!isActive && appState !== "starting" && (
				<div style={{ color: c.hintColor, fontSize: 12, marginBottom: 8 }}>
					Space to start / pause · Esc to stop
				</div>
			)}

			{/* Script textarea */}
			<textarea
				value={text}
				onChange={(e) => setText(e.target.value)}
				readOnly={isActive}
				rows={5}
				placeholder="Paste your script here…"
				style={{
					width: "100%", padding: 10, fontFamily: "inherit", resize: "vertical",
					background: isActive ? c.textareaLocked : c.textareaBg,
					color: isActive ? c.textareaLocked2 : c.textareaColor,
					border: `1px solid ${c.border}`, borderRadius: 6,
				}}
			/>
		</div>
	);
}
