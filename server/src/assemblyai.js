import { WebSocket } from "ws";

export function createAssemblyWsUrl({ speech_model, sample_rate, format_turns }) {
	const u = new URL("wss://streaming.assemblyai.com/v3/ws");
	u.searchParams.set("speech_model", speech_model);
	u.searchParams.set("sample_rate", String(sample_rate));
	u.searchParams.set("format_turns", String(format_turns));
	return u.toString();
}

export async function openAssemblySocket(aaiUrl) {
	const apiKey = process.env.ASSEMBLYAI_API_KEY;
	if (!apiKey) throw new Error("Missing ASSEMBLYAI_API_KEY");

	return new Promise((resolve, reject) => {
		const ws = new WebSocket(aaiUrl, { headers: { Authorization: apiKey } });
		ws.once("open", () => resolve(ws));
		ws.once("error", reject);
	});
	}
