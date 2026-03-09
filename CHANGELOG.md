# Changelog

## [0.1.0] - 2026-03-09

Initial working prototype.

### Added
- Script input — paste any plain text script to get started
- Script parser — splits text into paragraphs, sentences, and word tokens
- Microphone capture — records audio via the browser and streams PCM audio at 16 kHz to the backend
- Backend proxy — Node.js/Express server forwards audio to AssemblyAI and relays transcript events back to the client
- Real-time alignment — sliding window engine matches incoming transcript words against the script token array
- Word-level highlighting — next three upcoming words shown bold and highlighted; rest of active sentence in a softer highlight; spoken words and completed sentences fade to grey
- Auto-scroll — active sentence stays near the top-center of the viewport as the user reads
- Recording indicator — UI clearly shows when the microphone is active
