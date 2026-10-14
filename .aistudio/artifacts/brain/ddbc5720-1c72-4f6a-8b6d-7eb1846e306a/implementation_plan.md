# GestureVoice: Real-Time Hand Gesture to Voice Translator

A real-time assistive communication tool that bridges the gap between sign language users and non-signers. It translates live camera hand gestures and ASL signs into natural speech, while providing two-way speech-to-text so non-signers can speak back seamlessly.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following parameters were confirmed during our interactive clarification and have guided the technical architecture:

- **Confirmed Gesture Scope**: Prioritizing American Sign Language (ASL) fingerspelling (A–Z, numbers 0–9) alongside universal communication gestures (Hello, Thank You, Please, Help, Yes/No, I Love You, Stop, Water, Food, Nice to meet you, etc.).
- **Confirmed Recognition & Vocalization Mode**: Continuous auto-detect loop with intelligent motion stabilization and pause debounce, coupled with instant speech synthesis. A manual single-shot "Capture & Translate" trigger remains accessible at all times.
- **Confirmed Two-Way Communication**: Full duplex conversation layout featuring Sign-to-Voice (camera vision translating to spoken audio) and Voice-to-Sign/Text (microphone transcribing spoken replies into large high-contrast text and visual ASL cue cards).

---

## 1. Overview & Core Concept

- **What It Does**: GestureVoice turns any device's webcam or front camera into an assistive interpreter. As a user forms hand gestures or ASL signs, the app continuously captures optimized video frames, sends them to a server-side Gemini 3.8 Flash multimodal vision pipeline, translates the gesture into natural conversational phrases, and immediately vocalizes it via text-to-speech. When a hearing or non-signing conversation partner speaks back, speech recognition transcribes their words into real-time visual subtitles with corresponding ASL reference cards.
- **Target Audience / Persona**:
  - Deaf, hard-of-hearing, or non-verbal individuals who use sign language or gestures to express themselves.
  - Hearing conversation partners (retail workers, healthcare providers, friends, family, colleagues) who do not know sign language.
  - Students and learners practicing ASL signs with instant vocal feedback.
- **Key Value**: Eradicates communication friction in everyday face-to-face interactions without requiring expensive specialized hardware or proprietary sensor gloves.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Zero-State & Onboarding**:
   - The user opens the app and is greeted with an uncluttered, high-contrast workspace.
   - Clear camera preview card with an "Enable Camera" primary trigger. Interactive privacy note explaining that video frames are processed securely for real-time translation and never stored permanently.
   - Quick visual gesture cheat sheet / reference drawer showing popular ASL signs to test immediately (e.g. "Hello", "Thank You", "Yes", "Help", "Peace", "I Love You").

2. **Sign-to-Voice Translation (Signer Mode)**:
   - User activates "Continuous Live Translation" (or taps "Translate Current Sign").
   - Camera preview displays a lightweight ergonomic hand framing guide and visual motion confidence HUD.
   - When a stable gesture is recognized, the translated phrase displays in a high-contrast speech bubble, and the app immediately vocalizes the translation through the device speakers.
   - A rolling conversation transcript records every utterance with timestamps and speaker labels.

3. **Voice-to-Text Reply (Partner Mode)**:
   - The non-signing partner taps "Tap to Speak Reply" or uses the hands-free conversation toggle.
   - Speech-to-text displays live transcription in bold, extra-large type for easy reading from across a counter or table.
   - Relevant keywords automatically surface visual ASL finger-spelling cues or sign demonstration illustrations to help the partner learn or confirm comprehension.

4. **Customization & Accessibility Tools**:
   - Voice controls: select gender, accent, speaking speed (0.75x–1.25x), and pitch.
   - Auto-speak toggle (auto-vocalize vs. tap-to-vocalize).
   - High-contrast visual mode (light/dark with AAA contrast rating for readability under bright sunlight).
   - Gesture practice & reference library tab for browsing the complete ASL alphabet and essential signs.

### Visual Identity & Theme

- **Aesthetic Direction**: Utilitarian, crisp, accessibility-first design. Avoids playful clutter in favor of medical/assistive grade clarity and rapid one-handed mobile ergonomic zones.
- **Color Palette & Contrast**:
  - Canvas: Deep neutral slate-950 (Dark mode default for camera focus and battery conservation) with seamless switch to clean daylight slate-50.
  - Surfaces: Structural slate-900 / white cards with subtle hairline slate-800 borders.
  - Primary Accent: High-visibility Emerald (`#10b981`) indicating active camera status, verified speech output, and clear affordances.
  - Secondary Accent: Royal Indigo (`#6366f1`) for partner voice-reply flows.
- **Typography & Hierarchy**:
  - Display & Headings: `Plus Jakarta Sans` (bold, geometric, ultra-legible).
  - Body & Transcripts: `General Sans` or `Plus Jakarta Sans` (16px base, high line-height).
  - Data, confidence indicators, and timestamps: `JetBrains Mono` / tabular numerals.
- **Anti-Slop Discipline**:
  - Zero pill enclosures for static metadata (clean unboxed timestamps and labels separated by `·`).
  - No fake telemetry tickers, no pseudo-code headers, no generic purple gradients.
  - Strict top-bar contract: single wordmark, clean navigation, active mode switcher.

---

## 3. Key Product Decisions & Trade-Offs

- **Server-Side Multimodal Vision via Gemini 3.8 Flash**:
  - *Chosen Approach*: Stream periodic downsampled video snapshots (JPEG base64 at 640x480, throttled to 1–1.5s intervals when motion settles) to a dedicated server endpoint running Gemini 3.8 Flash.
  - *Why*: Gemini 3.8 Flash possesses state-of-the-art spatial understanding of hand finger configurations, wrist orientations, and multi-finger gestures, easily distinguishing subtle ASL signs (e.g. 'A' vs 'S' vs 'E', or dynamic signs like 'Thank You') that fragile client-only heuristics fail on.
  - *Alternatives Considered*: Client-only MediaPipe Hands heuristic classification was considered, but requires hundreds of manual geometric rules that break on angle shifts and cannot translate nuanced natural signs or sentence contexts. Gemini multimodal vision provides robust context-aware natural language translation.
- **Speech Synthesis Dual-Path**:
  - *Chosen Approach*: Instant client-side Web Speech API (`window.speechSynthesis`) with intelligent voice selection and pitch/rate tuning for sub-50ms zero-latency speech output, with graceful offline support.
  - *Why*: Immediate auditory feedback is critical when communicating face-to-face. Speech synthesis directly in the browser ensures real-time responsiveness without waiting for heavy audio round-trips.
- **Motion-Aware Snapshot Sampling**:
  - *Chosen Approach*: Client-side HTML5 canvas frame differencing detects when a signer holds a gesture steady before triggering translation, preventing redundant requests and avoiding repetitive vocal stuttering.
- **Local Fallback & Practice Dictionary**:
  - *Chosen Approach*: Include an offline ASL gesture dictionary with instant visual reference diagrams, finger-spelling cards, and emergency quick-phrase audio buttons (e.g. "Please speak slower", "I am deaf", "Thank you").

---

## 4. Technical Architecture & Data Strategy

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT FRONTEND (React 19)                      │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────┐ │
│  │   Camera Viewport     │  │  Two-Way Transcript   │  │ Voice & HUD │ │
│  │ - Video Stream (30fps)│  │ - Signer utterances   │  │ - SpeechSyn │ │
│  │ - Motion Stabilizer   │  │ - Partner STT replies │  │ - Audio vis │ │
│  │ - Frame Downsampler   │  │ - ASL Cue references  │  │ - Settings  │ │
│  └───────────┬───────────┘  └───────────▲───────────┘  └──────▲──────┘ │
│              │                          │                     │        │
│              │ base64 frame             │ text translation    │ speak  │
│              ▼                          │                     │        │
│  ┌──────────────────────────────────────┴─────────────────────┴──────┐ │
│  │                     Client Translation Controller                 │ │
│  └──────────────────────────────────┬────────────────────────────────┘ │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │ POST /api/translate-gesture
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    SERVER BACKEND (Node.js / Express)                  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  POST /api/translate-gesture                                      │  │
│  │  - Validates image base64 & context history                      │  │
│  │  - Invokes @google/genai SDK with model 'gemini-3.8-flash'       │  │
│  │  - Structured prompt with ASL & Universal Gesture Schema         │  │
│  │  - Returns { gesture, spokenText, confidence, explanation }      │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │ GEMINI_API_KEY                   │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                 Google GenAI (Gemini 3.8 Flash)                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Key API & Data Contracts

- **Server Endpoint (`/api/translate-gesture`)**:
  - *Input*:
    ```json
    {
      "image": "data:image/jpeg;base64,...",
      "previousGestures": ["HELLO", "MY_NAME_IS"],
      "mode": "continuous" | "single"
    }
    ```
  - *Output*:
    ```json
    {
      "detected": true,
      "gestureName": "THANK_YOU",
      "spokenText": "Thank you very much!",
      "category": "phrase" | "letter" | "number" | "universal",
      "confidence": "high" | "medium" | "low",
      "aslDescription": "Hand open at chin moving forward"
    }
    ```

- **Client State Stores**:
  - `isTranslating`: Active loop boolean.
  - `streamActive`: Webcam status.
  - `activeSpeech`: Current audio playback state.
  - `transcriptHistory`: Chronological log of conversational turns with timestamps, role, and text.
  - `speechSettings`: Voice URI, pitch (0.5–2.0), rate (0.5–2.0), autoSpeak boolean.
  - `quickPhrases`: Pre-configured emergency and conversational shortcuts.

---

## 5. Implementation Sequence & Next Steps

1. **Server Setup**: Add `/api/translate-gesture` proxy endpoint in server integration using `@google/genai` with `gemini-3.8-flash` multimodal vision and strict JSON schema output.
2. **Camera & Vision Engine**: Implement `CameraFeed` with canvas snapshot generator, motion stabilization debounce, and video stream lifecycle management.
3. **Voice Engine**: Implement `SpeechSynthesis` service with voice selector, volume/pitch/rate sliders, and real-time audio wave feedback.
4. **Partner Speech-to-Text**: Integrate browser `SpeechRecognition` for two-way conversations with large-text display and ASL visual cue rendering.
5. **ASL & Universal Gesture Library**: Interactive modal and sidebar with fingerspelling alphabet (A-Z) and common signs dictionary.
6. **Full-Viewport Accessible UI**: High-contrast, mobile-friendly touch targets ($\ge 44\text{px}$), ergonomic thumb controls, transcript drawer, and clear user settings.
