import "dotenv/config";
import express from "express";
import { WebSocketServer } from "ws";
import { createAssemblyWsUrl, openAssemblySocket } from "./assemblyai.js";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, "../../client/dist");

const VALID_SPEECH_MODELS = new Set(["universal-streaming", "universal-streaming-english", "slam-1"]);
const VALID_SAMPLE_RATES = new Set(["8000", "16000", "22050", "44100", "48000"]);
const VALID_FORMAT_TURNS = new Set(["true", "false"]);

const app = express();
app.use(express.static(clientDist));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("*", (_req, res) => res.sendFile(join(clientDist, "index.html")));

const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

const wss = new WebSocketServer({ server, path: "/stt" });

wss.on("connection", async (clientWs, req) => {
  console.log("Browser connected to /stt");

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const speech_model = url.searchParams.get("speech_model") ?? "universal-streaming-english";
    const sample_rate = url.searchParams.get("sample_rate") ?? "16000";
    const format_turns = url.searchParams.get("format_turns") ?? "false";

    if (!VALID_SPEECH_MODELS.has(speech_model)) {
      console.warn(`Rejected invalid speech_model: ${speech_model}`);
      clientWs.close(1008, "Invalid speech_model");
      return;
    }
    if (!VALID_SAMPLE_RATES.has(sample_rate)) {
      console.warn(`Rejected invalid sample_rate: ${sample_rate}`);
      clientWs.close(1008, "Invalid sample_rate");
      return;
    }
    if (!VALID_FORMAT_TURNS.has(format_turns)) {
      console.warn(`Rejected invalid format_turns: ${format_turns}`);
      clientWs.close(1008, "Invalid format_turns");
      return;
    }

    const aaiUrl = createAssemblyWsUrl({ speech_model, sample_rate, format_turns });
    console.log("Connecting to AssemblyAI...");

    const aaiWs = await openAssemblySocket(aaiUrl);
    console.log("Connected to AssemblyAI");

    // Forward AssemblyAI messages directly — no toString() to avoid corrupting binary frames
    aaiWs.on("message", (msg) => {
      if (clientWs.readyState === 1) clientWs.send(msg);
    });

    aaiWs.on("close", () => {
      console.log("AssemblyAI socket closed");
      if (clientWs.readyState === 1) clientWs.close();
    });

    aaiWs.on("error", (err) => {
      console.error("AssemblyAI socket error:", err);
      if (clientWs.readyState === 1) clientWs.close();
    });

    clientWs.on("message", (data) => {
      if (aaiWs.readyState === 1) aaiWs.send(data);
    });

    clientWs.on("close", () => {
      console.log("Browser socket closed");
      try { aaiWs.close(); } catch {}
    });
  } catch (err) {
    console.error("STT connection setup failed:", err);
    clientWs.close();
  }
});
