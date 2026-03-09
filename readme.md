# Teleprompter Web App

---

## Specification

This project proposes a teleprompter web app that follows a script in real time by listening to the speaker through their microphone. As the user reads aloud, the application converts speech to text using a streaming speech recognition service and aligns the spoken words with the script displayed on screen.

### User Flow

1. User pastes text into the application.
2. Script parser converts text into paragraphs, sentences, and tokens.
3. User clicks the microphone button to begin recording.
4. Microphone audio begins streaming to the backend.
5. Backend forwards audio to the speech provider.
6. Transcript events stream back to the client.
7. Alignment engine determines the current script position.
8. UI updates highlighting and scroll position.

### User Interface

- The teleprompter keeps the current sentence slightly above the center of the screen to guide the reader.
- The active sentence is determined by the position of the next upcoming word, so highlighting leads slightly ahead of what has been spoken rather than lagging behind.
- Within the active sentence, the next three words are shown in bold and highlighted to draw the reader's eye forward; the remaining words in that sentence are shown in a softer highlight color.
- Words already spoken within the active sentence, and all words in completed sentences, fade to grey. Upcoming sentences are shown in the default text color. No background highlight is used — all state is conveyed through text color alone.
- The system can recover if the user restarts a phrase or skips ahead in the script by realigning the transcript with the correct location in the text.

### Limitations

- The system focuses on English speech recognition and aims to perform reliably for both American and British accents.
- No user accounts, cloud storage, or script management features are included in the prototype phase.

### Security Concerns

- The prototype must clearly indicate when microphone recording is active.
- The system should not store or retain audio by default, and transcript data should only exist in memory during a session.
- The backend server should keep the speech provider API key secure and never expose it directly to the client.
- When deployed outside of local development, the application must run over HTTPS to allow microphone access in modern browsers.

---

## How It Works

### Technologies

The client is built with **React 18** and **TypeScript**, bundled and served by **Vite**. Script text is split into sentences using the **sbd** (sentence boundary detection) library. Microphone audio is captured via the **Web Audio API** using an `AudioWorklet` that downsamples input to 16-bit PCM at 16 kHz.

The backend is a **Node.js** server using **Express** and the **ws** library. It proxies audio frames from the client to **AssemblyAI** (Universal Streaming v3 API) and relays transcript events back to the browser, keeping API credentials secure on the server.

### Script Parsing

The parser converts pasted text into a structured internal representation. Paragraphs are detected using blank lines as separators. These breaks are preserved so the interface can render visual paragraph spacing in the teleprompter. Each paragraph is divided into sentences using a sentence boundary detection library. Each sentence is treated as a single teleprompter line and is the primary display unit used by the interface.

### Tokenization

Each sentence is further divided into tokens representing words and punctuation. The system maintains two forms of tokens:

- **Display tokens** — The exact words shown in the interface.
- **Normalized tokens** — Lowercase words stripped of punctuation, used for matching. This keeps alignment stable even when punctuation differs between the script and the transcript.

### Audio Capture

Audio is captured from the user's microphone through the browser and streamed to the backend over WebSocket. The backend forwards audio data to the speech provider and relays transcription results back to the client. AssemblyAI returns streaming transcript events with word-level timing and confidence data, which drive the highlighting.

### Alignment Engine

At any given moment the system maintains a **current position** in the script — a word index into a flat token array spanning all sentences. As transcript words arrive, they are normalized and matched against a **sliding window** around the current position. The window extends further forward than backward to favour natural forward progress while still allowing recovery from restarts.

#### Position Recovery
- If the transcript strongly matches words **later** in the script, the system assumes the user skipped ahead and advances accordingly.
- If the transcript matches words **earlier** in the current sentence, the system assumes the user restarted the phrase and rewinds the highlighting to the correct position.

---

## Future Work and Potential Improvements

### Paraphrasing Support
While the prototype focuses on word-perfect alignment, the system should be designed so that a later version can tolerate minor paraphrasing — situations where the speaker omits a small word, changes the order slightly, or substitutes a simple equivalent phrase while still reading essentially the same sentence.

### Script Management Features
Allowing users to upload scripts, save sessions, and return to unfinished recordings. Support for Markdown formatting could allow writers to include headings, emphasis, and other structural cues within scripts.

### Interface Improvements
The interface could evolve into a fully featured teleprompter tool with adjustable scrolling speed, customizable fonts and spacing, and presentation-friendly display modes.

### Language Improvements
Support for multiple languages, improved accent adaptation, and analytics about reading performance.

---

## Implementation Status

| Feature | Status |
|---|---|
| Script parsing (paragraphs → sentences) | ✅ Done |
| Microphone audio capture (PCM 16k) | ✅ Done |
| Backend WebSocket proxy to AssemblyAI | ✅ Done |
| Tokenization (display + normalized tokens) | ✅ Done |
| Alignment engine | ✅ Done |
| Word-level highlighting | ✅ Done |
| Sentence fade (completed → grey) | ✅ Done |
| Auto-scroll (current sentence near center) | ✅ Done |
| Recording active indicator | ✅ Done |
