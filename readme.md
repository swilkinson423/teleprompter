# Teleprompter Web App

## Specification

This project proposes a teleprompter web app that follows a script in real time by listening to the speaker through their microphone. As the user reads aloud, the application converts speech to text using a streaming speech recognition service and aligns the spoken words with the script displayed on screen.

---

### User Flow

1. User pastes text into the application.
2. Script parser converts text into paragraphs, sentences, and tokens.
3. User starts a session.
4. Microphone audio begins streaming to the backend.
5. Backend forwards audio to the speech provider.
6. Transcript events stream back to the client.
7. Alignment engine determines the current script position.
8. UI updates highlighting and scroll position.

---

### User Interface

- The teleprompter keeps the current sentence slightly above the center of the screen to guide the reader.
- Words are highlighted as they are spoken.
- Completed sentences fade to grey while upcoming sentences remain visible.
- The system can recover if the user restarts a phrase or skips ahead in the script by realigning the transcript with the correct location in the text.

---

### Limitations

- The system focuses on English speech recognition and aims to perform reliably for both American and British accents.
- No user accounts, cloud storage, or script management features are included in the prototype phase.

---

### Security Concerns

- The prototype must clearly indicate when microphone recording is active.
- The system should not store or retain audio by default, and transcript data should only exist in memory during a session.
- The backend server should keep the speech provider API key secure and never expose it directly to the client.
- When deployed outside of local development, the application must run over HTTPS to allow microphone access in modern browsers.

---

## Script Parsing & Location Tracking

The interface highlights words as they are spoken, fades completed phrases, and keeps the current line centered in the viewing area. The goal is to create a natural reading experience where the teleprompter advances automatically based on what the speaker says rather than scrolling at a fixed speed.

The initial version is designed to demonstrate that speech-driven script alignment can reliably power a teleprompter interface.

### Script Parsing

The prototype converts text into a structured internal representation that the alignment system can track. The parser processes the script in three stages:

#### Paragraph Detection
Paragraphs are detected using blank lines as separators. These breaks are preserved so the interface can render visual paragraph spacing in the teleprompter.

#### Sentence Segmentation
Each paragraph is divided into sentences using a sentence boundary detection library. Each sentence is treated as a single teleprompter line and is the primary display unit used by the interface.

#### Tokenization
Each sentence is further divided into tokens representing words and punctuation. The system maintains two forms of tokens:

- **Display tokens** — The exact words shown in the interface.
- **Normalized tokens** — Lowercase words stripped of punctuation, used for matching. The normalized tokens allow speech alignment to remain stable even when punctuation differs between the script and the transcript.

### Location Tracking

At any given moment the system maintains a **current location** in the script consisting of:
- The current sentence index
- The current word index within that sentence

The prototype uses a streaming speech-to-text provider that processes audio in real time and returns partial transcripts as the user speaks. To determine where the speaker is in the script, the system compares recognized words with the script text in a small window surrounding the current reading position.

#### Audio Capture
Audio is captured from the user's microphone through the browser and streamed to a backend server over WebSocket. The backend server acts as a proxy that forwards audio data to the speech provider and relays transcription results back to the client.

#### Word Recognition
The provider must support word-level timing information so that words can be highlighted individually as they are recognized. As speech recognition events arrive, the transcript words are normalized and compared against a small window of script tokens surrounding the current position. For the prototype, the alignment system assumes the user is reading the script relatively closely — it attempts to match the newest transcript tokens with the expected upcoming tokens in the script.

#### Alignment Engine
The alignment engine determines the speaker's position within the script by comparing recognized transcript tokens with the script text. To maintain performance while still allowing recovery from small jumps or restarts, the system searches within a **limited matching window**. This window includes:
- The current sentence
- Several upcoming sentences
- One or two previously completed sentences

#### Position Recovery
- If the transcript strongly matches words **later** in the script, the system assumes the user skipped ahead and advances the teleprompter position accordingly.
- If the transcript instead matches words **earlier** in the same sentence, the system assumes the user restarted the phrase and rewinds the word highlighting to the appropriate position.

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

## Development Setup

The prototype consists of a browser-based client application and a lightweight backend server that proxies audio streams to a speech-to-text provider.

### Client Application
A React- and Vite-based web interface responsible for rendering the teleprompter, parsing scripts, capturing microphone audio, and aligning recognized words with the script.

### Node.js Backend Server
The backend is implemented using Node.js with Express and WebSockets, allowing microphone audio to be streamed to the speech recognition provider while keeping API credentials secure. Real-time highlighting requires low-latency streaming transcription, so audio must be transmitted continuously rather than uploaded in larger segments.

### Speech Recognition Service
Performs real-time transcription of the microphone audio and returns partial transcripts along with word-level timing information. These results drive the highlighting behavior in the teleprompter.

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
