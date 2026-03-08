import { useEffect, useRef, useState } from "react";

type TurnWord = {
	start: number;
	end: number;
	text: string;
	confidence: number;
	word_is_final: boolean;
};

type TurnMsg = {
	type: "Turn";
	transcript: string;
	end_of_turn: boolean;
	words?: TurnWord[];
};

export type SttStatus = "disconnected" | "connecting" | "connected" | "error";

export function useStreamingStt() {
	const wsRef = useRef<WebSocket | null>(null);
	const [lastTurn, setLastTurn] = useState<TurnMsg | null>(null);
	const [status, setStatus] = useState<SttStatus>("disconnected");

	function connect() {
		setStatus("connecting");
		const url = new URL("/stt", window.location.href);
		url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
		url.searchParams.set("speech_model", "universal-streaming-english");
		url.searchParams.set("sample_rate", "16000");
		url.searchParams.set("format_turns", "false");

		const ws = new WebSocket(url.toString());
		ws.binaryType = "arraybuffer";
		ws.onopen = () => setStatus("connected");
		ws.onmessage = (ev) => {
			try {
				const text = typeof ev.data === "string"
					? ev.data
					: new TextDecoder().decode(ev.data as ArrayBuffer);
				const msg = JSON.parse(text);
				if (msg?.type === "Turn") setLastTurn(msg);
			} catch {
				// ignore malformed messages
			}
		};
		ws.onerror = () => setStatus("error");
		// Only move to disconnected if we didn't already flag an error
		ws.onclose = () => setStatus((prev) => (prev === "error" ? "error" : "disconnected"));
		wsRef.current = ws;
	}

	function sendAudioChunk(pcm16le: ArrayBuffer) {
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		ws.send(pcm16le);
	}

	function disconnect() {
		if (wsRef.current) {
			// Null out handlers before closing so onclose/onerror don't fire after an intentional disconnect
			wsRef.current.onopen = null;
			wsRef.current.onmessage = null;
			wsRef.current.onerror = null;
			wsRef.current.onclose = null;
			wsRef.current.close();
			wsRef.current = null;
		}
		setStatus("disconnected");
	}

	useEffect(() => () => disconnect(), []);
	return { connect, disconnect, sendAudioChunk, lastTurn, status };
}
